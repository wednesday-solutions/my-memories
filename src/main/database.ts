import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

let db: Database.Database | null = null;

// Cosine similarity function for vector search
// Returns similarity between 0 and 1 (1 = identical)
function cosineSimilarity(v1Str: string, v2Str: string): number {
  try {
    const v1 = JSON.parse(v1Str) as number[];
    const v2 = JSON.parse(v2Str) as number[];

    if (v1.length !== v2.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        normA += v1[i] * v1[i];
        normB += v2[i] * v2[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  } catch (e) {
    return 0;
  }
}

export function getDB() {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'memories.db');
  console.log("Opening database at:", dbPath);
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Register custom function for vector search
  db.function('cosine_similarity', cosineSimilarity);

    // Initialize Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, -- UUID or "app-slug"
        title TEXT,
        app_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT, -- 'user' | 'assistant'
        content TEXT,
        timestamp TEXT, -- Extracted timestamp like "6:57 PM"
        hash TEXT, -- SHA-256 of content for deduplication (legacy)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    -- Legacy 'memories' for vector search (optional link to message_id later)
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      raw_text TEXT, 
      source_app TEXT,
      session_id TEXT, 
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      embedding TEXT 
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        content, 
        content='memories'
    );

    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE,
      type TEXT NOT NULL DEFAULT 'Unknown',
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, type)
    );

    CREATE TABLE IF NOT EXISTS entity_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      fact TEXT NOT NULL,
      source_session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_id, fact),
      FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );
  `);

  // Triggers to keep FTS in sync
  const triggers = [
    `CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid, content) VALUES (new.id, new.content);
    END;`,
    `CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content) VALUES('delete', old.id, old.content);
    END;`,
    `CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content) VALUES('delete', old.id, old.content);
      INSERT INTO memory_fts(rowid, content) VALUES (new.id, new.content);
    END;`
  ];

  for(const trigger of triggers) {
      db.exec(trigger);
  }

  // Create Chat Summaries Table if not exists (migrating to conversations table eventually)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_summaries (
      session_id TEXT PRIMARY KEY,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create Master Memory Table - cumulative summary of all summaries
  db.exec(`
    CREATE TABLE IF NOT EXISTS master_memory (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      content TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add timestamp column to messages if it doesn't exist
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN timestamp TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  return db;
}

// === NEW API ACCESSORS ===

export function getChatSessions(appName?: string) {
    const db = getDB();
    // Query the new 'conversations' table
    // Also join with messages count if needed, or we keep a counter in conversations?
    // Let's do a join.
    let query = `
        SELECT 
            c.id as session_id,
            c.title,
            c.app_name as source_app,
            c.updated_at as last_activity,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
            (SELECT summary FROM chat_summaries cs WHERE cs.session_id = c.id) as summary
        FROM conversations c
    `;
    
    if (appName && appName !== 'All') {
        query += ` WHERE c.app_name LIKE ? `;
    }
    
    query += ` ORDER BY c.updated_at DESC`;

    const stmt = db.prepare(query);
    if (appName && appName !== 'All') {
        return stmt.all(`%${appName}%`);
    } else {
        return stmt.all();
    }
}

export function upsertChatSummary(sessionId: string, summary: string) {
    const db = getDB();
    const stmt = db.prepare(`
        INSERT INTO chat_summaries (session_id, summary, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id) DO UPDATE SET
            summary = excluded.summary,
            updated_at = excluded.updated_at
    `);
    stmt.run(sessionId, summary);
}

export function getMemoriesForSession(sessionId: string, limit: number = 200) {
    const db = getDB();
    // Fetch from new 'messages' table
    const stmt = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?');
    const messages = stmt.all(sessionId, limit);
    
    // Map to old Memory interface shape if needed by UI, or UI updates? 
    // UI expects { id, content, raw_text, source_app, created_at, role? }
    // We added 'role' to messages.
    return messages;
}

export function checkMessageExists(hash: string, conversationId: string): boolean {
    const db = getDB();
    const stmt = db.prepare('SELECT id FROM messages WHERE conversation_id = ? AND hash = ? LIMIT 1');
    const result = stmt.get(conversationId, hash);
    return !!result;
}

// Deprecated: old check
export function checkMemoryExists(content: string, sessionId: string): boolean {
    // Forward to new check logic if we want, or keep it for legacy?
    // We will use checkMessageExists for new flow.
    return false; 
}

// === MASTER MEMORY ===

export function getMasterMemory(): { content: string | null; updated_at: string | null } {
    const db = getDB();
    const result = db.prepare('SELECT content, updated_at FROM master_memory WHERE id = 1').get() as { content: string; updated_at: string } | undefined;
    return result || { content: null, updated_at: null };
}

export function updateMasterMemory(content: string) {
    const db = getDB();
    const stmt = db.prepare(`
        INSERT INTO master_memory (id, content, updated_at)
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            content = excluded.content,
            updated_at = excluded.updated_at
    `);
    stmt.run(content);
}

export function getAllChatSummaries(): { session_id: string; summary: string }[] {
    const db = getDB();
    const stmt = db.prepare('SELECT session_id, summary FROM chat_summaries WHERE summary IS NOT NULL');
    return stmt.all() as { session_id: string; summary: string }[];
}

// === ENTITIES ===

export function upsertEntity(name: string, type: string = 'Unknown'): number {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO entities (name, type, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name, type) DO UPDATE SET updated_at = excluded.updated_at
    `);
    stmt.run(name.trim(), type.trim() || 'Unknown');

    const row = db.prepare('SELECT id FROM entities WHERE name = ? AND type = ?').get(name.trim(), type.trim() || 'Unknown') as { id: number } | undefined;
    return row?.id || 0;
}

export function updateEntitySummary(entityId: number, summary: string) {
    const db = getDB();
    const stmt = db.prepare(`
      UPDATE entities SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(summary, entityId);
}

export function addEntityFact(entityId: number, fact: string, sessionId?: string): boolean {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO entity_facts (entity_id, fact, source_session_id)
      VALUES (?, ?, ?)
    `);
    const info = stmt.run(entityId, fact.trim(), sessionId || null);
    return info.changes > 0;
}

export function getEntities(appName?: string) {
    const db = getDB();
    let query = `
      SELECT 
        e.id,
        e.name,
        e.type,
        e.summary,
        e.updated_at,
        COUNT(f.id) as fact_count
      FROM entities e
      LEFT JOIN entity_facts f ON f.entity_id = e.id
      LEFT JOIN conversations c ON f.source_session_id = c.id
    `;

    const params: any[] = [];
    if (appName && appName !== 'All') {
        query += ` WHERE c.app_name LIKE ? `;
        params.push(`%${appName}%`);
    }

    query += ` GROUP BY e.id ORDER BY e.updated_at DESC`;
    const stmt = db.prepare(query);
    return stmt.all(...params);
}

export function getEntityDetails(entityId: number, appName?: string) {
    const db = getDB();
    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId);

    let factsQuery = `
      SELECT f.id, f.fact, f.source_session_id, f.created_at
      FROM entity_facts f
      LEFT JOIN conversations c ON f.source_session_id = c.id
      WHERE f.entity_id = ?
    `;
    const params: any[] = [entityId];
    if (appName && appName !== 'All') {
        factsQuery += ` AND c.app_name LIKE ? `;
        params.push(`%${appName}%`);
    }
    factsQuery += ` ORDER BY f.created_at DESC`;

    const facts = db.prepare(factsQuery).all(...params);
    return { entity, facts };
}
