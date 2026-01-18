import { ipcMain } from 'electron';
import { getDB, getChatSessions, upsertChatSummary, getMemoriesForSession, getMasterMemory, updateMasterMemory, getAllChatSummaries, upsertEntity, addEntityFact, updateEntitySummary, getEntities, getEntityDetails } from './database';
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

async function extractEntitiesForSession(sessionId: string): Promise<void> {
    const memories = getMemoriesForSession(sessionId);
    if (!memories || memories.length === 0) return;

    const conversationText = memories.map((m: any) => `[${m.role || 'unknown'}]: ${m.content}`).join('\n');
    const prompt = `You are extracting entities from a conversation to build long-term entity memory.

Return JSON only with this shape:
{
  "entities": [
    {
      "name": "string",
      "type": "Person | Organization | Company | Product | Place | Object | Project | Concept | Event | Other",
      "facts": ["short factual statements about the entity"]
    }
  ]
}

Rules:
- Only include entities that are explicitly mentioned.
- Normalize names (no extra whitespace).
- Facts must be concise and specific.
- If no entities, return {"entities": []}.

Conversation:
${conversationText}

JSON:`;

    try {
        const { llm } = await import('./llm');
        const response = await llm.chat(prompt);
        const parsed = safeParseJson<{ entities: { name: string; type?: string; facts?: string[] }[] }>(response, { entities: [] });

        if (!parsed.entities || parsed.entities.length === 0) return;

        for (const entity of parsed.entities) {
            const name = (entity.name || '').trim();
            if (!name) continue;
            const type = (entity.type || 'Unknown').trim() || 'Unknown';
            const facts = Array.isArray(entity.facts) ? entity.facts.filter(Boolean).map(f => f.trim()).filter(Boolean) : [];

            const entityId = upsertEntity(name, type);
            if (!entityId) continue;

            const newFacts: string[] = [];
            for (const fact of facts) {
                const inserted = addEntityFact(entityId, fact, sessionId);
                if (inserted) newFacts.push(fact);
            }

            if (newFacts.length === 0) continue;

            const details = getEntityDetails(entityId);
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

  // Master Memory handlers
  ipcMain.handle('db:get-master-memory', () => {
      return getMasterMemory();
  });

  ipcMain.handle('db:regenerate-master-memory', async () => {
      return await regenerateMasterMemory();
  });
}
