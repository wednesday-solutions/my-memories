import { ipcMain } from 'electron';
import { getDB, getChatSessions, upsertChatSummary, getMemoriesForSession, getMemoryRecordsForSession, getMasterMemory, updateMasterMemory, getAllChatSummaries, upsertEntity, addEntityFact, updateEntitySummary, getEntities, getEntityDetails, upsertEntitySession, rebuildEntityEdgesForSession, getEntityGraph, rebuildEntityEdgesForAllSessions, deleteEntity, deleteMemory, getEntitiesForSession, getDashboardStats } from './database';
import { embeddings } from './embeddings';
// import { llm } from './llm'; // Moved to dynamic import to support ESM

// Regenerate master memory from all chat summaries
async function regenerateMasterMemory(): Promise<string | null> {
    const summaries = getAllChatSummaries();
    if (summaries.length === 0) {
        updateMasterMemory('');
        return null;
    }

    const summaryText = summaries.map((s, i) => `### Conversation ${i + 1}: ${s.session_id}\n${s.summary}`).join('\n\n---\n\n');
    
    const prompt = `You are creating a MASTER MEMORY - a comprehensive knowledge base synthesized from multiple conversation summaries.

Analyze all the following conversation summaries and create a unified, well-organized master summary that:
1. **Consolidates Knowledge**: Merge related topics and remove redundancy
2. **Identifies Patterns**: Note recurring themes, preferences, and important facts about the user
3. **Preserves Key Details**: Keep specific technical details, decisions, and recommendations
4. **Creates a Profile**: Build an understanding of the user's interests, projects, and needs
5. **Highlights Important Information**: Facts, preferences, and context that would be useful to remember

Organize the output clearly with sections for different topic areas.

Conversation Summaries:
${summaryText}

Master Memory:`;

    try {
        const { llm } = await import('./llm');
        const masterContent = await llm.chat(prompt);
        updateMasterMemory(masterContent);
        console.log('[IPC] Master memory regenerated successfully');
        return masterContent;
    } catch (e) {
        console.error('[IPC] Failed to regenerate master memory:', e);
        return null;
    }
}

function safeParseJson<T>(input: string, fallback: T): T {
    try {
        const clean = input.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(clean) as T;
    } catch {
        return fallback;
    }
}

const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'know', 'about', 'your', 'you', 'me', 'my', 'all', 'do',
    'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'will', 'would', 'should', 'could', 'can', 'may', 'might'
]);

function tokenizeQuery(query: string, maxTokens: number = 6): string[] {
    const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .map(t => t.replace(/[^a-z0-9_-]/g, ''))
        .filter(t => t.length >= 3)
        .filter(t => !STOPWORDS.has(t));
    return Array.from(new Set(tokens)).slice(0, maxTokens);
}

function clipText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, Math.max(0, maxLength - 1)) + '…';
}

function isTrivialMessage(text: string): boolean {
    const normalized = (text || '').trim();
    if (normalized.length === 0) return true;
    if (normalized.length < 20) {
        if (/^(hi|hello|hey|thanks|thank you|ok|okay|sure|yes|no|cool|great|nice|good|fine|bye|see ya|yep|nope)[!.]?$/i.test(normalized)) {
            return true;
        }
    }
    return false;
}

async function insertMemoryRecord(params: {
    content: string;
    rawText?: string | null;
    sourceApp?: string | null;
    sessionId?: string | null;
    messageId?: number | null;
}): Promise<number | null> {
    const db = getDB();
    const content = (params.content || '').trim();
    if (!content) return null;

    if (params.messageId) {
        const existing = db.prepare('SELECT id FROM memories WHERE message_id = ? LIMIT 1').get(params.messageId) as { id: number } | undefined;
        if (existing?.id) return existing.id;
    }

    if (params.sessionId) {
        const existing = db.prepare('SELECT id FROM memories WHERE session_id = ? AND content = ? LIMIT 1').get(params.sessionId, content) as { id: number } | undefined;
        if (existing?.id) return existing.id;
    }

    let vectorJson = '[]';
    try {
        const vector = await embeddings.generateEmbedding(content);
        vectorJson = JSON.stringify(vector);
    } catch (e) {
        console.error('Failed to generate embedding for memory record:', e);
    }

    const stmt = db.prepare('INSERT INTO memories (content, raw_text, source_app, session_id, embedding, message_id) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(
        content,
        params.rawText || null,
        params.sourceApp || null,
        params.sessionId || null,
        vectorJson,
        params.messageId || null
    );
    return Number(info.lastInsertRowid || 0) || null;
}

export async function evaluateAndStoreMemoryForMessage(params: {
    sessionId: string;
    appName: string;
    role: string;
    content: string;
    messageId?: number | null;
}): Promise<void> {
    const role = (params.role || 'unknown').toLowerCase();
    const text = (params.content || '').trim();
    if (!text || isTrivialMessage(text)) return;

        const prompt = `You are a strict memory filter. Decide if the following single message should be saved as LONG-TERM memory that a user would want in future chats.

Store ONLY durable, user-relevant information such as:
- Stable personal preferences or profile facts
- Ongoing projects, specs, requirements, or architecture choices
- Decisions made or commitments
- Important instructions or constraints
- Long-term plans, schedules, or goals
- Key factual statements about important entities the user is likely to reference later

Do NOT store:
- Greetings, small talk, or pleasantries
- One-off troubleshooting steps or ephemeral details
- Generic statements or common knowledge
- Redundant facts already implied by the message itself
- Speculation or unverified claims
- Anything that won’t matter in future conversations

If the role is 'assistant', store ONLY if it repeats a verified user fact or a decision the user made.
If unsure, set store to false.

Return JSON ONLY with this shape:
{
    "store": boolean,
    "memory": "short standalone statement suitable for future retrieval"
}

Role: ${role}
Message: ${text}
JSON:`;

    try {
        const { llm } = await import('./llm');
        const response = await llm.chat(prompt);
        const parsed = safeParseJson<{ store: boolean; memory?: string }>(response, { store: false });
        if (!parsed.store) return;
        const memoryText = (parsed.memory || '').trim();
        if (!memoryText) return;
        if (memoryText.split(/\s+/).length < 4) return;
        if (memoryText.length > 280) return;

        await insertMemoryRecord({
            content: memoryText,
            rawText: text,
            sourceApp: params.appName,
            sessionId: params.sessionId,
            messageId: params.messageId || null
        });
    } catch (e) {
        console.error('[IPC] Memory evaluation failed:', e);
    }
}

async function extractEntitiesForSession(sessionId: string): Promise<void> {
        const memories = getMemoryRecordsForSession(sessionId);
        if (!memories || memories.length === 0) return;

        const memoryText = memories.map((m: any) => `- ${m.content}`).join('\n');
        const prompt = `You are extracting entities from long-term memory statements. Only keep entities worth remembering for future chats.

Return JSON only with this shape:
{
    "entities": [
        {
            "name": "string",
            "type": "Person | Organization | Product | Place | Object | Project | Concept | Event | Other",
            "facts": ["short factual statements about the entity"]
        }
    ]
}

Rules:
- Only include entities explicitly mentioned in the memory statements.
- Include ONLY entities that are likely to be referenced again (user-relevant people, projects, products, places, or systems).
- Exclude generic tools, common technologies, or incidental mentions unless they are clearly tied to the user’s ongoing work or preferences.
- Facts must be concise, specific, and durable.
- If no entities meet the criteria, return {"entities": []}.

Memory statements:
${memoryText}

JSON:`;

    try {
        const { llm } = await import('./llm');
        const response = await llm.chat(prompt);
        const parsed = safeParseJson<{ entities: { name: string; type?: string; facts?: string[] }[] }>(response, { entities: [] });

        if (!parsed.entities || parsed.entities.length === 0) return;

        const touchedEntityIds = new Set<number>();
        for (const entity of parsed.entities) {
            const name = (entity.name || '').trim();
            if (!name) continue;
            const type = (entity.type || 'Unknown').trim() || 'Unknown';
            const facts = Array.isArray(entity.facts) ? entity.facts.filter(Boolean).map(f => f.trim()).filter(Boolean) : [];

            if (name.length < 2) continue;
            if (facts.length === 0) continue;

            const entityId = upsertEntity(name, type);
            if (!entityId) continue;
            touchedEntityIds.add(entityId);
            upsertEntitySession(entityId, sessionId);

            const newFacts: string[] = [];
            for (const fact of facts) {
                const inserted = addEntityFact(entityId, fact, sessionId);
                if (inserted) newFacts.push(fact);
            }

            if (newFacts.length === 0) continue;

            const details = getEntityDetails(entityId) as { entity?: { summary?: string } } | null;
            const existingSummary = details?.entity?.summary || '';

            const summaryPrompt = `You are updating an entity profile summary.

Entity: ${name}
Type: ${type}

Existing summary:
${existingSummary || '(none)'}

New facts:
- ${newFacts.join('\n- ')}

Write a concise, well-structured summary. Include only verified facts. Do not add speculation. Output plain text only.`;

            try {
                const updatedSummary = await llm.chat(summaryPrompt);
                if (updatedSummary && updatedSummary.trim()) {
                    updateEntitySummary(entityId, updatedSummary.trim());
                }
            } catch (e) {
                console.error('[IPC] Failed to update entity summary:', e);
            }
        }

        if (touchedEntityIds.size > 1) {
            rebuildEntityEdgesForSession(sessionId);
        }
    } catch (e) {
        console.error('[IPC] Entity extraction failed:', e);
    }
}


export async function summarizeSession(sessionId: string): Promise<string | null> {
    const memories = getMemoriesForSession(sessionId);
    if (!memories || memories.length === 0) return null;

    const conversationText = memories.map((m: any) => `[${m.role || 'unknown'}]: ${m.content}`).join('\n');
    const prompt = `You are an expert at analyzing conversations. Create a VERY DETAILED summary of the following chat conversation.

Include ALL of these elements in your summary:
1. **Main Topic**: What is the primary subject being discussed?
2. **Key Questions Asked**: List any important questions the user asked
3. **Answers & Information Received**: Document specific facts, data, explanations, or solutions provided
4. **Technical Details**: Include any code snippets, commands, configurations, or technical specifications mentioned
5. **Recommendations**: Any suggestions or best practices shared
6. **Decisions Made**: Any conclusions reached or choices decided upon
7. **Action Items**: Any follow-up tasks or next steps identified
8. **Key Entities**: People, tools, technologies, locations, or concepts mentioned

Be thorough and specific. Do not omit important details. The summary should allow someone who hasn't read the conversation to fully understand what was discussed.

Conversation:
${conversationText}

Detailed Summary:`;

    try {
        const { llm } = await import('./llm');
        const summary = await llm.chat(prompt);
        upsertChatSummary(sessionId, summary);

        // Extract and update entity memory
        extractEntitiesForSession(sessionId);
        
        // Regenerate master memory after updating a summary
        regenerateMasterMemory();
        
        return summary;
    } catch (e) {
        console.error("Failed to summarize session:", e);
        throw e;
    }
}

export function setupIPC() {
  const db = getDB();

  ipcMain.handle('db:get-memories', (_, limit: number = 50, appName?: string) => {
    let query = 'SELECT * FROM memories ';
    const params: any[] = [];
    
    if (appName && appName !== 'All') {
        query += 'WHERE source_app LIKE ? ';
        params.push(`%${appName}%`);
    }
    
    query += 'ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const stmt = db.prepare(query);
    // SQLite stores timestamps as UTC strings "YYYY-MM-DD HH:MM:SS" by default with CURRENT_TIMESTAMP
    // To ensure JS treats them as UTC, we might need to append 'Z' or standardise.
    // However, simplest is to let frontend handle "UTC" assumption.
    return stmt.all(...params);
  });

  ipcMain.handle('db:add-memory', async (_, content: string, source: string = 'user-input', sessionId?: string) => {
    // Generate embedding
    let vectorJson = '[]';
    try {
       const vector = await embeddings.generateEmbedding(content);
       vectorJson = JSON.stringify(vector);
    } catch (e) {
       console.error("Failed to generate embedding:", e);
    }
    
    // Check if we can update an existing session
    if (sessionId) {
        // Look for a recent memory (e.g. last 12 hours) with this session_id
        const existing = db.prepare('SELECT id FROM memories WHERE session_id = ? AND created_at > datetime("now", "-12 hours") ORDER BY id DESC LIMIT 1').get(sessionId) as {id: number} | undefined;
        
        if (existing) {
             console.log(`Updating existing memory session ${sessionId} (ID: ${existing.id})`);
             const stmt = db.prepare('UPDATE memories SET content = ?, embedding = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?');
             stmt.run(content, vectorJson, existing.id);
             return { id: existing.id, updated: true };
        }
    }

    const stmt = db.prepare('INSERT INTO memories (content, source_app, session_id, embedding) VALUES (?, ?, ?, ?)');
    const info = stmt.run(content, source, sessionId || null, vectorJson);
    return { id: info.lastInsertRowid };
  });

ipcMain.handle('db:search-memories', async (_, query: string) => {
    try {
        const queryVector = await embeddings.generateEmbedding(query);
        const vecStr = JSON.stringify(queryVector);
        
        const stmt = db.prepare(`
          SELECT *, cosine_similarity(embedding, ?) as score 
          FROM memories 
          WHERE embedding IS NOT NULL AND embedding != '[]'
          ORDER BY score DESC 
          LIMIT 20
        `);
        return stmt.all(vecStr);
    } catch (e) {
        console.error("Vector search failed, falling back to FTS", e);
        const stmt = db.prepare(`
          SELECT memories.* 
          FROM memories 
          JOIN memory_fts ON memories.id = memory_fts.rowid 
          WHERE memory_fts MATCH ? 
          LIMIT 20
        `);
        return stmt.all(query);
    }
  });
  
  ipcMain.handle('db:get-stats', () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM memories').get();
      return count;
  });

  ipcMain.handle('db:get-dashboard-stats', () => {
      return getDashboardStats();
  });

  ipcMain.handle('llm:extract', async (_, text: string) => {
      try {
        const { llm } = await import('./llm');
        const response = await llm.chat(`Analyze the following text and extract a summary and key topics. Return JSON only with keys: summary, topic, entities. Text: "${text}"`);
        
        // Basic cleanup if the model returns markdown code blocks
        const cleanJson = response.replace(/```json\n?|\n?```/g, '').trim();
        
        return JSON.parse(cleanJson);
      } catch (e) {
         console.error("LLM Extraction failed:", e);
         // Fallback
         return {
            summary: text.slice(0, 50) + "...",
            topic: "General (Fallback)",
            entities: []
         };
      }
  });

  ipcMain.handle('llm:status', async () => {
      const { llm } = await import('./llm');
      return {
          ready: llm.isReady()
      };
  });

  ipcMain.handle('rag:chat', async (_, query: string, appName?: string) => {
      const db = getDB();
      const tokens = tokenizeQuery(query);
      const ftsQuery = tokens.length > 0 ? tokens.join(' OR ') : query;

      let memories: any[] = [];
      try {
          const queryVector = await embeddings.generateEmbedding(query);
          const vecStr = JSON.stringify(queryVector);
          const params: any[] = [vecStr];
          let memoryQuery = `
            SELECT *, cosine_similarity(embedding, ?) as score
            FROM memories
            WHERE embedding IS NOT NULL AND embedding != '[]'
          `;
          if (appName && appName !== 'All') {
              memoryQuery += ` AND source_app LIKE ? `;
              params.push(`%${appName}%`);
          }
          memoryQuery += ` ORDER BY score DESC LIMIT 12`;
          memories = db.prepare(memoryQuery).all(...params);
          memories = memories.filter((m: any) => typeof m.score !== 'number' || m.score >= 0.2);
      } catch (e) {
          console.error('[RAG] Vector search failed, falling back to FTS', e);
          const params: any[] = [];
          let fallbackQuery = `
            SELECT memories.*
            FROM memories
            JOIN memory_fts ON memories.id = memory_fts.rowid
            WHERE memory_fts MATCH ?
          `;
          params.push(query);
          if (appName && appName !== 'All') {
              fallbackQuery += ` AND memories.source_app LIKE ? `;
              params.push(`%${appName}%`);
          }
          fallbackQuery += ` LIMIT 12`;
          memories = db.prepare(fallbackQuery).all(...params);
      }

            const messageParams: any[] = [ftsQuery];
            let messageQuery = `
                SELECT m.id, m.conversation_id, m.role, m.content, m.created_at, c.title, c.app_name,
                             bm25(message_fts) as score
                FROM message_fts
                JOIN messages m ON message_fts.rowid = m.id
                JOIN conversations c ON c.id = m.conversation_id
                WHERE message_fts MATCH ?
            `;
            if (appName && appName !== 'All') {
                    messageQuery += ` AND c.app_name LIKE ? `;
                    messageParams.push(`%${appName}%`);
            }
            messageQuery += ` ORDER BY score ASC LIMIT 12`;
            const messages = db.prepare(messageQuery).all(...messageParams);

            const summaryParams: any[] = [ftsQuery];
            let summaryQuery = `
                SELECT cs.session_id, cs.summary, c.title, c.app_name, c.updated_at,
                             bm25(summary_fts) as score
                FROM summary_fts
                JOIN chat_summaries cs ON summary_fts.rowid = cs.rowid
                JOIN conversations c ON c.id = cs.session_id
                WHERE summary_fts MATCH ?
            `;
            if (appName && appName !== 'All') {
                    summaryQuery += ` AND c.app_name LIKE ? `;
                    summaryParams.push(`%${appName}%`);
            }
            summaryQuery += ` ORDER BY score ASC LIMIT 8`;
            const summaries = db.prepare(summaryQuery).all(...summaryParams);

            const entityParams: any[] = [ftsQuery];
            let entityQuery = `
                SELECT e.id, e.name, e.type, e.summary, e.updated_at,
                             bm25(entity_fts) as score
                FROM entity_fts
                JOIN entities e ON entity_fts.rowid = e.id
                WHERE entity_fts MATCH ?
            `;
            if (appName && appName !== 'All') {
                    entityQuery += `
                        AND e.id IN (
                            SELECT es.entity_id
                            FROM entity_sessions es
                            JOIN conversations c ON c.id = es.session_id
                            WHERE c.app_name LIKE ?
                        )
                    `;
                    entityParams.push(`%${appName}%`);
            }
            entityQuery += ` ORDER BY score ASC LIMIT 8`;
            const entities = db.prepare(entityQuery).all(...entityParams);

            const factParams: any[] = [ftsQuery];
            let factQuery = `
                SELECT f.fact, f.created_at, f.source_session_id, e.name, e.type,
                             bm25(entity_fact_fts) as score
                FROM entity_fact_fts
                JOIN entity_facts f ON entity_fact_fts.rowid = f.id
                JOIN entities e ON e.id = f.entity_id
                WHERE entity_fact_fts MATCH ?
            `;
            if (appName && appName !== 'All') {
                    factQuery += ` AND f.source_session_id IN (SELECT id FROM conversations WHERE app_name LIKE ?) `;
                    factParams.push(`%${appName}%`);
            }
            factQuery += ` ORDER BY score ASC LIMIT 8`;
            const entityFacts = db.prepare(factQuery).all(...factParams);

    const master = getMasterMemory();
    const masterContent = master?.content || '';
    const masterRelevant = tokens.length > 0 && tokens.some(t => masterContent.toLowerCase().includes(t));
    const masterFallback = !masterRelevant && (!memories.length && !messages.length && !summaries.length && !entities.length && !entityFacts.length);

      const memoryLines = memories.slice(0, 6).map((m: any, idx: number) =>
          `- [Memory ${idx + 1}] (${m.source_app || 'Unknown'} | ${m.created_at}): ${clipText(m.content, 500)}`
      ).join('\n');

      const messageLines = messages.slice(0, 6).map((m: any, idx: number) =>
          `- [Message ${idx + 1}] (${m.app_name || 'Unknown'} | ${m.title || 'Untitled'} | ${m.created_at}) ${m.role}: ${clipText(m.content, 400)}`
      ).join('\n');

      const summaryLines = summaries.slice(0, 6).map((s: any, idx: number) =>
          `- [Summary ${idx + 1}] (${s.app_name || 'Unknown'} | ${s.title || 'Untitled'}): ${clipText(s.summary, 600)}`
      ).join('\n');

      const entityLines = entities.slice(0, 6).map((e: any, idx: number) =>
          `- [Entity ${idx + 1}] (${e.type || 'Unknown'}) ${e.name}: ${clipText(e.summary || '', 400)}`
      ).join('\n');

      const factLines = entityFacts.slice(0, 6).map((f: any, idx: number) =>
          `- [Entity Fact ${idx + 1}] (${f.type || 'Unknown'}) ${f.name}: ${clipText(f.fact, 400)}`
      ).join('\n');

    const contextBlock = `MASTER MEMORY:\n${masterRelevant || masterFallback ? clipText(masterContent || '(none)', 500) : '(not relevant)'}\n\nRELEVANT MEMORIES:\n${memoryLines || '(none)'}\n\nRELEVANT MESSAGES:\n${messageLines || '(none)'}\n\nRELEVANT SUMMARIES:\n${summaryLines || '(none)'}\n\nRELEVANT ENTITIES:\n${entityLines || '(none)'}\n\nRELEVANT ENTITY FACTS:\n${factLines || '(none)'}`;

    const prompt = `You are a helpful assistant that answers using ONLY the provided context from the user's memories, conversations, summaries, and entities.
Prefer specific evidence from messages, summaries, entities, and memories over the master memory. Use the master memory only as supplemental context.
If the context does not contain the answer, say you don't have that information and ask a brief follow-up question.
Do not fabricate details. Cite evidence by referencing item labels like [Memory 2] or [Message 3].

User question:
${query}

Context:
${contextBlock}

Answer:`;

      try {
          const { llm } = await import('./llm');
          const answer = await llm.chat(prompt);
          return {
              answer,
              context: {
                  masterMemory: masterRelevant || masterFallback ? masterContent : null,
                  memories,
                  messages,
                  summaries,
                  entities,
                  entityFacts
              }
          };
      } catch (e) {
          console.error('[RAG] LLM chat failed:', e);
          return {
              answer: 'Sorry, I could not generate a response right now.',
              context: {
                  masterMemory: masterRelevant || masterFallback ? masterContent : null,
                  memories,
                  messages,
                  summaries,
                  entities,
                  entityFacts
              }
          };
      }
  });

  ipcMain.handle('db:get-chat-sessions', (_, appName?: string) => {
      return getChatSessions(appName);
  });
  ipcMain.handle('db:get-memories-for-session', (_, sessionId: string) => {
      // Need to export this from database.ts first or import it
      return getMemoriesForSession(sessionId);
  });
  ipcMain.handle('db:get-entities', (_, appName?: string) => {
      return getEntities(appName);
  });
  ipcMain.handle('db:get-entity-details', (_, entityId: number, appName?: string) => {
      return getEntityDetails(entityId, appName);
  });
  ipcMain.handle('db:get-entities-for-session', (_, sessionId: string) => {
      return getEntitiesForSession(sessionId);
  });
  ipcMain.handle('db:get-memory-records-for-session', (_, sessionId: string) => {
      return getMemoryRecordsForSession(sessionId);
  });

  ipcMain.handle('db:get-entity-graph', (_, appName?: string, focusEntityId?: number, edgeLimit: number = 200) => {
      return getEntityGraph(appName, focusEntityId, edgeLimit);
  });

  ipcMain.handle('db:rebuild-entity-graph', () => {
      rebuildEntityEdgesForAllSessions();
      return true;
  });
  ipcMain.handle('db:delete-session', async (_, sessionId: string) => {
      const db = getDB();
      // Delete from new tables (messages will cascade due to foreign key)
      db.prepare('DELETE FROM conversations WHERE id = ?').run(sessionId);
      // Also delete from legacy tables for cleanup
      db.prepare('DELETE FROM memories WHERE session_id = ?').run(sessionId);
      db.prepare('DELETE FROM chat_summaries WHERE session_id = ?').run(sessionId);
      console.log(`Deleted session: ${sessionId}`);
      
      // Regenerate master memory after deletion
      await regenerateMasterMemory();
      
      return true;
  });

  ipcMain.handle('llm:summarize-session', async (_, sessionId: string) => {
      return await summarizeSession(sessionId);
  });

  ipcMain.handle('db:get-master-memory', () => {
      return getMasterMemory();
  });

  ipcMain.handle('db:delete-entity', (_, entityId: number) => {
      const result = deleteEntity(entityId);
      console.log(`[IPC] Deleted entity ${entityId}: ${result}`);
      return result;
  });

  ipcMain.handle('db:delete-memory', (_, memoryId: number) => {
      const result = deleteMemory(memoryId);
      console.log(`[IPC] Deleted memory ${memoryId}: ${result}`);
      return result;
  });

  ipcMain.handle('db:regenerate-master-memory', async () => {
      return await regenerateMasterMemory();
  });
}
