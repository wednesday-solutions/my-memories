import { ipcMain, BrowserWindow } from 'electron';
import { getDB, getChatSessions, upsertChatSummary, getMemoriesForSession, getMemoryRecordsForSession, getMasterMemory, updateMasterMemory, getAllChatSummaries, upsertEntity, addEntityFact, updateEntitySummary, getEntities, getEntityDetails, upsertEntitySession, rebuildEntityEdgesForSession, getEntityGraph, rebuildEntityEdgesForAllSessions, deleteEntity, deleteMemory, getEntitiesForSession, getDashboardStats, getUserProfile, saveUserProfile, UserProfile, createRagConversation, getRagConversations, getRagConversation, deleteRagConversation, addRagMessage, getRagMessages, updateRagConversationTitle, getSettings, saveSetting, getSetting } from './database';
import { embeddings } from './embeddings';
import { getPermissionStatus, requestAccessibilityPermission, requestScreenRecordingPermission, openAccessibilitySettings, openScreenRecordingSettings } from './permissions';
// import { llm } from './llm'; // Moved to dynamic import to support ESM

// Incrementally update master memory with a new conversation summary
// This approach keeps context bounded by only processing current master + new summary
async function updateMasterMemoryIncremental(newSummary: string): Promise<string | null> {
    console.log('[IPC] Starting incremental master memory update...');
    const currentMasterData = getMasterMemory();
    const currentMaster = currentMasterData?.content;

    // If no existing master memory, create initial one from just this summary
    if (!currentMaster || currentMaster.trim().length === 0) {
        console.log('[IPC] No existing master memory, creating from new summary only');
        const prompt = `You are creating a comprehensive MASTER MEMORY — a detailed knowledge base about a user.

Create a thorough, well-organized reference document from this conversation summary. Be DETAILED and COMPREHENSIVE - this document can be up to 5000 words. Include every relevant piece of information.

## Required Sections (include all that have content):

### About the User
- Full professional background, role, title, company
- Technical skills and expertise levels
- Years of experience in different areas
- Education or certifications mentioned
- Location, timezone, working hours

### Projects & Work
- All projects mentioned with full details (names, descriptions, tech stacks, status)
- Project goals, timelines, constraints
- Team structure and collaborators
- Past projects and their outcomes

### Technical Environment
- Operating system, hardware, development machines
- IDEs, editors, and tools used
- Languages and frameworks with proficiency levels
- Databases, cloud services, infrastructure
- Development workflow and practices

### Architectural Preferences
- Design patterns preferred
- Code organization and structure
- API design preferences
- Testing approaches
- Performance considerations

### Stated Preferences & Opinions
- Explicitly stated likes and dislikes
- Strong opinions on technologies, practices, or approaches
- Communication style preferences
- Work style (collaborative vs independent, etc.)

### Key Decisions Made
- Technical decisions with rationale
- Tool or framework choices
- Architectural decisions
- Process decisions

### Important Relationships
- People mentioned (colleagues, clients, managers)
- Organizations and companies referenced
- Communities or groups involved with

### Recurring Themes & Interests
- Topics frequently discussed
- Areas of active learning
- Long-term goals and aspirations

Guidelines:
- Write in third person ("The user prefers...", "They work on...")
- Include ALL specific details: names, versions, exact preferences
- Preserve nuance and context
- Be comprehensive, not brief

Conversation Summary:
${newSummary}

Master Memory:`;

        try {
            const { llm } = await import('./llm');
            const initialMaster = await llm.chat(prompt, [], 180000); // 3 min timeout
            updateMasterMemory(initialMaster);
            console.log('[IPC] Initial master memory created');
            return initialMaster;
        } catch (e) {
            console.error('[IPC] Failed to create initial master memory:', e);
            return null;
        }
    }

    // Incremental update: merge new summary with existing master (no truncation - allow growth)
    const prompt = `You are updating a comprehensive MASTER MEMORY — a detailed knowledge base about a user.

This document should be DETAILED and COMPREHENSIVE, up to 5000 words. DO NOT summarize or shorten - preserve all existing information and ADD new details.

CURRENT MASTER MEMORY:
${currentMaster}

---

NEW CONVERSATION SUMMARY to integrate:
${newSummary}

---

YOUR TASK: Produce an UPDATED master memory that integrates ALL new information.

Rules:
1. PRESERVE all existing information - do not remove or shorten anything
2. ADD new facts, details, and context from the new summary
3. MERGE related information into appropriate sections
4. UPDATE information only if explicitly contradicted by newer info
5. EXPAND sections with new details rather than replacing
6. Maintain all the detailed sections (About User, Projects, Technical Environment, etc.)
7. The result should be MORE detailed than the input, not less
8. Write in third person

Updated Master Memory:`;

    try {
        const { llm } = await import('./llm');
        const updatedMaster = await llm.chat(prompt, [], 180000); // 3 min timeout
        updateMasterMemory(updatedMaster);
        console.log('[IPC] Master memory updated incrementally');
        return updatedMaster;
    } catch (e) {
        console.error('[IPC] Failed to update master memory incrementally:', e);
        return null;
    }
}

// Full regeneration - processes summaries in batches
// Used when explicitly requested or when starting from scratch
async function regenerateMasterMemoryFull(): Promise<string | null> {
    const summaries = getAllChatSummaries();
    if (summaries.length === 0) {
        updateMasterMemory('');
        return null;
    }

    console.log(`[IPC] Starting full master memory regeneration from ${summaries.length} summaries...`);

    const { llm } = await import('./llm');

    // Process in batches of 3 for detailed processing
    const BATCH_SIZE = 3;
    let currentMaster = '';

    for (let i = 0; i < summaries.length; i += BATCH_SIZE) {
        const batch = summaries.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(summaries.length / BATCH_SIZE);

        console.log(`[IPC] Processing batch ${batchNum}/${totalBatches}...`);

        const batchText = batch.map((s, j) => `[Session ${i + j + 1}]\n${s.summary}`).join('\n\n---\n\n');

        const isFirstBatch = i === 0;

        const prompt = isFirstBatch
            ? `You are building a comprehensive MASTER MEMORY from conversation summaries. This should be DETAILED - up to 5000 words.

Include ALL these sections with full details:
- About the User (background, skills, role, location)
- Projects & Work (all projects with details, tech stacks, status)
- Technical Environment (OS, tools, languages, frameworks)
- Architectural Preferences (patterns, practices, approaches)
- Stated Preferences & Opinions (likes, dislikes, strong opinions)
- Key Decisions Made (technical and process decisions)
- Important Relationships (people, organizations)
- Recurring Themes & Interests

Write in third person. Include ALL specific details - names, versions, exact preferences. Be comprehensive.

Conversation Summaries:
${batchText}

Master Memory:`
            : `You are EXPANDING a master memory with additional conversation summaries.

This document should be COMPREHENSIVE - up to 5000 words. DO NOT summarize or shorten.

CURRENT MASTER MEMORY:
${currentMaster}

---

ADDITIONAL SUMMARIES (batch ${batchNum}):
${batchText}

---

EXPAND the master memory with ALL new information. PRESERVE everything existing. ADD new details. The result should be MORE detailed, not less. Write in third person.

Expanded Master Memory:`;

        try {
            currentMaster = await llm.chat(prompt, [], 240000); // 4 min timeout per batch
        } catch (e) {
            console.error(`[IPC] Batch ${batchNum} failed:`, e);
            if (currentMaster) break; // Use what we have
            throw e; // Fail if no progress
        }
    }

    updateMasterMemory(currentMaster);
    console.log(`[IPC] Master memory regenerated from ${summaries.length} summaries`);
    return currentMaster;
}

// Main entry point - full regeneration
async function regenerateMasterMemory(): Promise<string | null> {
    return regenerateMasterMemoryFull();
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
    const memoryId = Number(info.lastInsertRowid || 0) || null;
    
    // Send notification about new memory
    if (memoryId) {
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('notification:new-memory', {
                sessionId: params.sessionId || null,
                memoryContent: content.slice(0, 100) + (content.length > 100 ? '...' : '')
            });
        });
    }
    
    return memoryId;
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

    // Get strictness setting
    const strictness = getSetting<'lenient' | 'balanced' | 'strict'>('memoryStrictness', 'balanced');
    
    // Build strictness-specific prompt
    let storeInstructions = '';
    let dontStoreInstructions = '';
    
    if (strictness === 'lenient') {
        storeInstructions = `Store information that could be useful in future conversations, including:
- Personal preferences, facts, or profile information
- Projects, specs, requirements, or technical choices
- Decisions, commitments, or agreements
- Instructions, constraints, or guidelines
- Plans, schedules, goals, or deadlines
- Facts about entities, tools, technologies mentioned
- General knowledge shared that might be referenced again`;
        
        dontStoreInstructions = `Do NOT store:
- Simple greetings or pleasantries
- Generic filler phrases`;
    } else if (strictness === 'strict') {
        storeInstructions = `Store ONLY high-value, explicitly stated information:
- Direct personal preferences the user explicitly stated
- Major decisions or commitments clearly made
- Critical project requirements explicitly mentioned
- Core facts about important entities central to the user's work`;
        
        dontStoreInstructions = `Do NOT store:
- Greetings, small talk, or pleasantries
- Troubleshooting steps or temporary solutions
- Generic statements or common knowledge
- Technical details that are easily searchable
- Speculation, suggestions, or hypotheticals
- Anything not explicitly and directly stated by the user
- Inferred or implied information`;
    } else {
        // balanced (default) — tightened
        storeInstructions = `Store ONLY explicitly stated, durable, high-signal information such as:
- Personal preferences the user directly and clearly stated ("I prefer X", "I always use Y")
- Concrete project names, product names, or specific technical architecture decisions
- Firm decisions or commitments the user explicitly made ("We decided to go with X", "I chose Y")
- Specific constraints, requirements, or deadlines stated as facts
- Long-term goals or plans the user described in their own words`;

        dontStoreInstructions = `Do NOT store:
- Greetings, small talk, pleasantries, or filler
- Code snippets, error messages, stack traces, or log output
- Questions the user asked (unless the question itself reveals a strong preference)
- Assistant explanations, suggestions, or recommendations (unless the user confirmed them as a decision)
- One-off troubleshooting steps, debugging attempts, or ephemeral details
- Generic or common-knowledge statements ("React is a library", "APIs use HTTP")
- Vague or implied preferences ("seems like they like X")
- Redundant facts already implied by the message itself
- Speculation, hypotheticals, or unverified claims
- Anything that won't clearly matter in future conversations`;
    }

    const prompt = `You are a ${strictness === 'strict' ? 'very strict' : strictness === 'lenient' ? 'inclusive' : 'balanced'} memory filter. Decide if the following single message should be saved as LONG-TERM memory that a user would want in future chats.

${storeInstructions}

${dontStoreInstructions}

If the role is 'assistant', store ONLY if it repeats a verified user fact or a decision the user made.
If unsure, set store to ${strictness === 'lenient' ? 'true' : 'false'}.

Return JSON ONLY with this shape:
{
    "store": boolean,
    "memory": "short standalone statement suitable for future retrieval"
}

Role: ${role}
Message: ${text}
JSON:`;

    // Minimum content length filter: skip very short messages
    if (role === 'user' && text.length < 30) return;
    if (role === 'assistant' && text.length < 50) return;

    try {
        const { llm } = await import('./llm');
        const response = await llm.chat(prompt);
        const parsed = safeParseJson<{ store: boolean; memory?: string }>(response, { store: false });
        if (!parsed.store) return;
        const memoryText = (parsed.memory || '').trim();
        if (!memoryText) return;
        if (memoryText.split(/\s+/).length < 4) return;
        if (memoryText.length > 280) return;

        // Post-LLM filter: skip memories matching generic / low-value patterns
        const genericPatterns = [
            /^the user (asked|said|mentioned|wanted|is|was|has|had)\b/i,
            /^(this|that|it) (is|was|seems|appears|looks)\b/i,
            /^(a|an|the) (good|great|nice|common|typical|standard|normal)\b/i,
            /\b(in general|generally speaking|as usual|as always)\b/i,
        ];
        if (genericPatterns.some(p => p.test(memoryText))) return;

        // Post-LLM filter: skip near-duplicates via substring check against existing session memories
        if (params.sessionId) {
            const existingMemories = getMemoryRecordsForSession(params.sessionId);
            const memLower = memoryText.toLowerCase();
            const isDuplicate = existingMemories.some((m: any) => {
                const existing = (m.content || '').toLowerCase();
                return existing === memLower || existing.includes(memLower) || memLower.includes(existing);
            });
            if (isDuplicate) return;
        }

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

        // Get strictness setting
        const strictness = getSetting<'lenient' | 'balanced' | 'strict'>('entityStrictness', 'balanced');

        const memoryText = memories.map((m: any) => `- ${m.content}`).join('\n');
        
        // Build strictness-specific rules
        let rules = '';
        if (strictness === 'lenient') {
            rules = `Rules:
- Include all entities mentioned in the memory statements.
- Include people, organizations, products, places, projects, technologies, tools, and concepts.
- Be inclusive - if an entity is mentioned, it's probably worth tracking.
- Facts should be concise and verifiable.
- Return {\"entities\": []} only if there are no discernible entities at all.`;
        } else if (strictness === 'strict') {
            rules = `Rules:
- Only include entities that are CENTRAL to the user's work or life.
- Exclude generic tools, common technologies, libraries, or frameworks unless the user has a specific relationship to them.
- Exclude one-time mentions or incidental references.
- Only include entities the user has explicitly discussed in detail or shown clear importance.
- Facts must be specific, verified, and directly from the memory statements.
- When in doubt, exclude the entity.
- Return {\"entities\": []} if no entities are clearly significant.`;
        } else {
            // balanced (default) — tightened
            rules = `Rules:
- Only include entities explicitly and repeatedly mentioned or clearly central to the user's work.
- Include ONLY entities the user has a specific, ongoing relationship with (their projects, their tools, people they work with, organizations they belong to).
- Exclude passing mentions, one-off references, generic examples, or entities mentioned only in assistant advice.
- Exclude generic or common single-word entities like "API", "database", "server", "frontend", "backend", "app", "website", "code".
- Exclude entities used only as illustrative examples or in generic advice.
- Entity names must be at least 3 characters long.
- Facts must be concise, specific, durable, and directly from the memory statements — no inferred facts.
- If no entities clearly meet the bar, return {\"entities\": []}.`;
        }
        
        const prompt = `You are extracting entities from long-term memory statements. ${strictness === 'strict' ? 'Be very selective - only keep high-value entities.' : strictness === 'lenient' ? 'Be inclusive - capture entities that might be useful later.' : 'Only keep entities worth remembering for future chats.'}

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

${rules}

Memory statements:
${memoryText}

JSON:`;

    try {
        const { llm } = await import('./llm');
        const response = await llm.chat(prompt);
        const parsed = safeParseJson<{ entities: { name: string; type?: string; facts?: string[] }[] }>(response, { entities: [] });

        if (!parsed.entities || parsed.entities.length === 0) return;

        // Blocklist of very common short entity names that are too generic
        const ENTITY_BLOCKLIST = new Set([
            'api', 'app', 'web', 'url', 'css', 'sql', 'cli', 'ide', 'ui', 'ux',
            'html', 'http', 'json', 'xml', 'yaml', 'code', 'data', 'file', 'bug',
            'server', 'client', 'database', 'frontend', 'backend', 'website',
            'user', 'admin', 'test', 'dev', 'prod', 'staging'
        ]);

        const touchedEntityIds = new Set<number>();
        for (const entity of parsed.entities) {
            const name = (entity.name || '').trim();
            if (!name) continue;
            const type = (entity.type || 'Unknown').trim() || 'Unknown';
            const facts = Array.isArray(entity.facts) ? entity.facts.filter(Boolean).map(f => f.trim()).filter(Boolean) : [];

            // Min name length: 3 chars
            if (name.length < 3) continue;
            if (facts.length === 0) continue;
            // Skip blocklisted generic names
            if (ENTITY_BLOCKLIST.has(name.toLowerCase())) continue;

            const entityId = upsertEntity(name, type);
            if (!entityId) continue;
            touchedEntityIds.add(entityId);
            upsertEntitySession(entityId, sessionId);

            const newFacts: string[] = [];
            for (const fact of facts) {
                const inserted = addEntityFact(entityId, fact, sessionId);
                if (inserted) newFacts.push(fact);
            }

            // Send notification about new entity with facts
            if (newFacts.length > 0) {
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('notification:new-entity', {
                        entityId,
                        entityName: name,
                        entityType: type,
                        factsCount: newFacts.length
                    });
                });
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
    const prompt = `You are extracting a user profile summary from a conversation. This summary will be aggregated with others to build a master memory of who this user is.

FOCUS ON THE USER, NOT THE ASSISTANT. Extract information that reveals:

## User Identity & Context
- What is the user working on? (specific project names, company, role)
- What is their technical background/skill level?
- What domain or industry are they in?

## User Preferences & Working Style
- How do they prefer to work? (tools, frameworks, languages)
- What coding style or conventions do they follow?
- What do they explicitly like or dislike?

## Decisions & Commitments
- What specific choices did the user make in this conversation?
- What approaches did they commit to?
- What did they reject or decide against?

## Problems & Goals
- What problems were they trying to solve?
- What are their stated goals or objectives?
- What constraints or requirements do they have?

## Key Relationships
- People mentioned (colleagues, clients, team members)
- Projects and their status
- Technologies and tools they actively use (not just discussed)

IMPORTANT GUIDELINES:
- Write from a third-person perspective about "the user"
- Include ONLY information that came from or was confirmed by the user
- Skip generic assistant advice, explanations, or code examples
- Skip anything the user merely asked about but didn't adopt
- Focus on durable facts, not transient details
- Be concise but specific - names, versions, concrete details matter

Conversation:
${conversationText}

User Profile Summary:`;

    try {
        const { llm } = await import('./llm');
        const summary = await llm.chat(prompt);
        upsertChatSummary(sessionId, summary);

        // Extract and update entity memory
        extractEntitiesForSession(sessionId);

        // Incrementally update master memory with the new summary (context-efficient)
        updateMasterMemoryIncremental(summary);

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

  ipcMain.handle('rag:chat', async (_, query: string, appName?: string, conversationHistory?: { role: string; content: string }[]) => {
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

    // Build conversation history block if provided
    let historyBlock = '';
    if (conversationHistory && conversationHistory.length > 0) {
        const historyLines = conversationHistory.map(msg => 
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${clipText(msg.content, 500)}`
        ).join('\n\n');
        historyBlock = `\nCONVERSATION HISTORY:\n${historyLines}\n`;
    }

    const prompt = `You are a helpful assistant that answers using ONLY the provided context from the user's memories, conversations, summaries, and entities.
Prefer specific evidence from messages, summaries, entities, and memories over the master memory. Use the master memory only as supplemental context.
If the context does not contain the answer, say you don't have that information and ask a brief follow-up question.
Do not fabricate details. Cite evidence by referencing item labels like [Memory 2] or [Message 3].
${historyBlock}
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

  // User Profile handlers
  ipcMain.handle('db:get-user-profile', () => {
      return getUserProfile();
  });

  ipcMain.handle('db:save-user-profile', (_, profile: UserProfile) => {
      saveUserProfile(profile);
      console.log('[IPC] User profile saved:', profile);
      return true;
  });

  // Permission handlers
  ipcMain.handle('permissions:get-status', () => {
      return getPermissionStatus();
  });

  ipcMain.handle('permissions:request-accessibility', () => {
      return requestAccessibilityPermission();
  });

  ipcMain.handle('permissions:open-accessibility-settings', () => {
      openAccessibilitySettings();
      return true;
  });

  ipcMain.handle('permissions:open-screen-recording-settings', () => {
      openScreenRecordingSettings();
      return true;
  });

  ipcMain.handle('permissions:request-screen-recording', async () => {
      return await requestScreenRecordingPermission();
  });

  // === RAG CONVERSATION HANDLERS ===
  
  ipcMain.handle('rag:create-conversation', (_, id: string, title?: string) => {
      return createRagConversation(id, title);
  });

  ipcMain.handle('rag:get-conversations', () => {
      return getRagConversations();
  });

  ipcMain.handle('rag:get-conversation', (_, id: string) => {
      return getRagConversation(id);
  });

  ipcMain.handle('rag:get-messages', (_, conversationId: string) => {
      return getRagMessages(conversationId);
  });

  ipcMain.handle('rag:add-message', (_, conversationId: string, role: 'user' | 'assistant', content: string, context?: any) => {
      return addRagMessage(conversationId, role, content, context);
  });

  ipcMain.handle('rag:update-conversation-title', (_, id: string, title: string) => {
      updateRagConversationTitle(id, title);
      return true;
  });

  ipcMain.handle('rag:delete-conversation', (_, id: string) => {
      return deleteRagConversation(id);
  });

  // === SETTINGS HANDLERS ===
  
  ipcMain.handle('settings:get', () => {
      return getSettings();
  });

  ipcMain.handle('settings:save', (_, key: string, value: any) => {
      saveSetting(key, value);
      console.log(`[IPC] Setting saved: ${key} =`, value);
      return true;
  });

  // === REPROCESS ALL SESSIONS ===

  ipcMain.handle('db:reprocess-all-sessions', async (_, clean: boolean = false) => {
      const db = getDB();
      const sessions = db.prepare('SELECT id FROM conversations').all() as { id: string }[];
      let processed = 0;

      if (clean) {
          // Clean reprocess: delete all old data and rebuild from scratch
          console.log('[IPC] Clean reprocess: clearing all entities, facts, edges, and memories...');

          // Drop FTS AFTER DELETE triggers first — if the FTS index is out of sync
          // with the source tables, the delete triggers will error and silently
          // prevent rows from being deleted. We recreate them after.
          db.exec('DROP TRIGGER IF EXISTS memories_ad');
          db.exec('DROP TRIGGER IF EXISTS entities_ad');
          db.exec('DROP TRIGGER IF EXISTS entity_facts_ad');

          // Delete only strictness-dependent data (children first)
          // Conversations, messages, chat_summaries, and master_memory are NOT touched
          db.prepare('DELETE FROM entity_edges').run();
          db.prepare('DELETE FROM entity_facts').run();
          db.prepare('DELETE FROM entity_sessions').run();
          db.prepare('DELETE FROM entities').run();
          db.prepare('DELETE FROM memories').run();

          // Recreate the delete triggers
          db.exec(`CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
              INSERT INTO memory_fts(memory_fts, rowid, content) VALUES('delete', old.id, old.content);
          END;`);
          db.exec(`CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
              INSERT INTO entity_fts(entity_fts, rowid, name, summary, type) VALUES('delete', old.id, old.name, old.summary, old.type);
          END;`);
          db.exec(`CREATE TRIGGER IF NOT EXISTS entity_facts_ad AFTER DELETE ON entity_facts BEGIN
              INSERT INTO entity_fact_fts(entity_fact_fts, rowid, fact, entity_id) VALUES('delete', old.id, old.fact, old.entity_id);
          END;`);

          // Rebuild FTS indexes so they reflect the now-empty source tables
          try {
              db.exec("INSERT INTO memory_fts(memory_fts) VALUES('rebuild')");
              db.exec("INSERT INTO entity_fts(entity_fts) VALUES('rebuild')");
              db.exec("INSERT INTO entity_fact_fts(entity_fact_fts) VALUES('rebuild')");
          } catch (e) {
              console.error('[IPC] FTS rebuild during clean reprocess failed (non-fatal):', e);
          }

          const deletedCounts = {
              entities: (db.prepare('SELECT COUNT(*) as c FROM entities').get() as { c: number }).c,
              memories: (db.prepare('SELECT COUNT(*) as c FROM memories').get() as { c: number }).c,
              facts: (db.prepare('SELECT COUNT(*) as c FROM entity_facts').get() as { c: number }).c,
          };
          console.log('[IPC] Post-delete counts (should all be 0):', deletedCounts);

          // Notify frontend to refresh immediately after clearing
          BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('reprocess:progress', { phase: 'cleared', processed: 0, total: sessions.length });
          });

          for (const session of sessions) {
              try {
                  // Re-evaluate memories for each message in the session
                  const msgs = db.prepare('SELECT id, role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(session.id) as { id: number; role: string; content: string }[];
                  const conv = db.prepare('SELECT app_name FROM conversations WHERE id = ?').get(session.id) as { app_name: string } | undefined;
                  const appName = conv?.app_name || 'Unknown';

                  for (const msg of msgs) {
                      await evaluateAndStoreMemoryForMessage({
                          sessionId: session.id,
                          appName,
                          role: msg.role,
                          content: msg.content,
                          messageId: msg.id
                      });
                  }

                  // Re-extract entities from the newly created memories
                  await extractEntitiesForSession(session.id);
                  processed++;

                  // Send progress updates
                  BrowserWindow.getAllWindows().forEach(win => {
                      win.webContents.send('reprocess:progress', { phase: 'processing', processed, total: sessions.length });
                  });
              } catch (e) {
                  console.error(`[IPC] Failed to reprocess session ${session.id}:`, e);
              }
          }

          // Rebuild entity edges from mentions across all entities
          rebuildEntityEdgesForAllSessions();
      } else {
          // Additive reprocess: keep existing data, just re-run entity extraction on top
          console.log('[IPC] Additive reprocess: re-extracting entities with current settings (keeping existing data)...');
          for (const session of sessions) {
              try {
                  await extractEntitiesForSession(session.id);
                  processed++;
              } catch (e) {
                  console.error(`[IPC] Failed to reprocess session ${session.id}:`, e);
              }
          }
      }

      console.log(`[IPC] Reprocessed ${processed} sessions (clean=${clean}) with current strictness settings`);
      return { processed, total: sessions.length };
  });
}

