#!/usr/bin/env node

/**
 * Demo Database Seed Script for My Memories
 *
 * Usage:
 *   node scripts/seed-demo.mjs          # Create demo DB (backs up existing)
 *   node scripts/seed-demo.mjs --restore # Restore original DB from backup
 *
 * This creates a rich demo database with:
 * - 10 conversations across Claude Desktop, Claude.ai, ChatGPT, Gemini
 * - 100+ messages with realistic content
 * - 40+ extracted memories with real vector embeddings
 * - 20+ entities with facts and relationships
 * - Entity edges for 3D knowledge graph
 * - Chat summaries and master memory
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';

// ============================================================
// CONFIG
// ============================================================

const DB_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'my-memories');
const DB_PATH = path.join(DB_DIR, 'memories.db');
const BACKUP_PATH = path.join(DB_DIR, 'memories.db.backup');

/** Run SQL against the demo DB using sqlite3 CLI */
function sql(statement) {
  const input = 'PRAGMA trusted_schema = ON;\n' + statement;
  execFileSync('sqlite3', [DB_PATH], { input, stdio: ['pipe', 'pipe', 'pipe'] });
}

/** Run SQL and return output */
function sqlQuery(statement) {
  const input = 'PRAGMA trusted_schema = ON;\n' + statement;
  return execFileSync('sqlite3', [DB_PATH], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

/** Escape string for SQL (single quotes) */
function esc(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// ============================================================
// RESTORE MODE
// ============================================================

if (process.argv.includes('--restore')) {
  if (!fs.existsSync(BACKUP_PATH)) {
    console.error('No backup found at:', BACKUP_PATH);
    process.exit(1);
  }
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(DB_PATH + ext)) fs.unlinkSync(DB_PATH + ext);
    if (fs.existsSync(BACKUP_PATH + ext)) {
      fs.renameSync(BACKUP_PATH + ext, DB_PATH + ext);
    }
  }
  fs.renameSync(BACKUP_PATH, DB_PATH);
  console.log('Restored original database from backup.');
  process.exit(0);
}

// ============================================================
// SCHEMA (from database.ts)
// ============================================================

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    app_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT,
    content TEXT,
    timestamp TEXT,
    hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  raw_text TEXT,
  source_app TEXT,
  session_id TEXT,
  message_id INTEGER,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  embedding TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(content, content='memories');
CREATE VIRTUAL TABLE IF NOT EXISTS message_fts USING fts5(content, conversation_id UNINDEXED, content='messages', content_rowid='id');
CREATE VIRTUAL TABLE IF NOT EXISTS summary_fts USING fts5(summary, session_id UNINDEXED, content='chat_summaries');
CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts USING fts5(name, summary, type, content='entities', content_rowid='id');
CREATE VIRTUAL TABLE IF NOT EXISTS entity_fact_fts USING fts5(fact, entity_id UNINDEXED, content='entity_facts', content_rowid='id');

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

CREATE TABLE IF NOT EXISTS entity_sessions (
  entity_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_id, session_id),
  FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY(session_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entity_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_entity_id INTEGER NOT NULL,
  target_entity_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'cooccurrence',
  weight REAL NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  last_session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_entity_id, target_entity_id, type),
  FOREIGN KEY(source_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY(target_entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_summaries (
  session_id TEXT PRIMARY KEY,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS master_memory (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  context TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(conversation_id) REFERENCES rag_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memories_message_id ON memories(message_id);
`;

const TRIGGERS_SQL = [
  `CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN INSERT INTO memory_fts(rowid, content) VALUES (new.id, new.content); END;`,
  `CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN INSERT INTO memory_fts(memory_fts, rowid, content) VALUES('delete', old.id, old.content); END;`,
  `CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN INSERT INTO memory_fts(memory_fts, rowid, content) VALUES('delete', old.id, old.content); INSERT INTO memory_fts(rowid, content) VALUES (new.id, new.content); END;`,
  `CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN INSERT INTO message_fts(rowid, content, conversation_id) VALUES (new.id, new.content, new.conversation_id); END;`,
  `CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN INSERT INTO message_fts(message_fts, rowid, content, conversation_id) VALUES('delete', old.id, old.content, old.conversation_id); END;`,
  `CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN INSERT INTO message_fts(message_fts, rowid, content, conversation_id) VALUES('delete', old.id, old.content, old.conversation_id); INSERT INTO message_fts(rowid, content, conversation_id) VALUES (new.id, new.content, new.conversation_id); END;`,
  `CREATE TRIGGER IF NOT EXISTS summaries_ai AFTER INSERT ON chat_summaries BEGIN INSERT INTO summary_fts(rowid, summary, session_id) VALUES (new.rowid, new.summary, new.session_id); END;`,
  `CREATE TRIGGER IF NOT EXISTS summaries_ad AFTER DELETE ON chat_summaries BEGIN INSERT INTO summary_fts(summary_fts, rowid, summary, session_id) VALUES('delete', old.rowid, old.summary, old.session_id); END;`,
  `CREATE TRIGGER IF NOT EXISTS summaries_au AFTER UPDATE ON chat_summaries BEGIN INSERT INTO summary_fts(summary_fts, rowid, summary, session_id) VALUES('delete', old.rowid, old.summary, old.session_id); INSERT INTO summary_fts(rowid, summary, session_id) VALUES (new.rowid, new.summary, new.session_id); END;`,
  `CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN INSERT INTO entity_fts(rowid, name, summary, type) VALUES (new.id, new.name, new.summary, new.type); END;`,
  `CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN INSERT INTO entity_fts(entity_fts, rowid, name, summary, type) VALUES('delete', old.id, old.name, old.summary, old.type); END;`,
  `CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN INSERT INTO entity_fts(entity_fts, rowid, name, summary, type) VALUES('delete', old.id, old.name, old.summary, old.type); INSERT INTO entity_fts(rowid, name, summary, type) VALUES (new.id, new.name, new.summary, new.type); END;`,
  `CREATE TRIGGER IF NOT EXISTS entity_facts_ai AFTER INSERT ON entity_facts BEGIN INSERT INTO entity_fact_fts(rowid, fact, entity_id) VALUES (new.id, new.fact, new.entity_id); END;`,
  `CREATE TRIGGER IF NOT EXISTS entity_facts_ad AFTER DELETE ON entity_facts BEGIN INSERT INTO entity_fact_fts(entity_fact_fts, rowid, fact, entity_id) VALUES('delete', old.id, old.fact, old.entity_id); END;`,
  `CREATE TRIGGER IF NOT EXISTS entity_facts_au AFTER UPDATE ON entity_facts BEGIN INSERT INTO entity_fact_fts(entity_fact_fts, rowid, fact, entity_id) VALUES('delete', old.id, old.fact, old.entity_id); INSERT INTO entity_fact_fts(rowid, fact, entity_id) VALUES (new.id, new.fact, new.entity_id); END;`,
];

// ============================================================
// HELPER: date offsets
// ============================================================

function daysAgo(n, hour = 10, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

function timeStr(hour, min) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:${String(min).padStart(2, '0')} ${ampm}`;
}

// ============================================================
// DEMO DATA
// ============================================================

const CONVERSATIONS = [
  {
    id: 'react-dashboard-claude-desktop',
    title: 'Building a Real-time Dashboard with React',
    app_name: 'Claude Desktop',
    created_at: daysAgo(12, 9, 15),
    updated_at: daysAgo(12, 10, 45),
    messages: [
      { role: 'user', content: "I'm building a real-time analytics dashboard for our SaaS product. We need to show live user activity, revenue metrics, and system health. What's the best architecture with React?", ts: [9, 15] },
      { role: 'assistant', content: "For a real-time dashboard, I'd recommend this architecture:\n\n1. **Data Layer**: WebSocket connection for live updates, with React Query for initial data fetching and cache management\n2. **State Management**: Zustand for global dashboard state — it's lightweight and perfect for real-time data streams\n3. **Visualization**: D3.js wrapped in React components, or Recharts for simpler charts\n4. **Layout**: CSS Grid with a responsive panel system, allowing users to customize their dashboard layout\n\nThe key pattern is a WebSocket provider at the top of your component tree that distributes real-time events to individual widgets via React Context.", ts: [9, 17] },
      { role: 'user', content: "We're currently using Redux but it feels heavy for this. Sarah from our team suggested Zustand too. How would the WebSocket integration work with Zustand?", ts: [9, 22] },
      { role: 'assistant', content: "Great choice moving to Zustand. Here's the pattern:\n\n```typescript\nconst useDashboardStore = create((set) => ({\n  metrics: {},\n  connected: false,\n  initWebSocket: () => {\n    const ws = new WebSocket('wss://api.yourapp.com/live');\n    ws.onopen = () => set({ connected: true });\n    ws.onmessage = (event) => {\n      const data = JSON.parse(event.data);\n      set((state) => ({\n        metrics: { ...state.metrics, [data.key]: data.value }\n      }));\n    };\n  }\n}));\n```\n\nThe beauty of Zustand is that only components subscribing to specific metrics will re-render. With Redux, you'd often get unnecessary re-renders across the entire dashboard. For a dashboard with 20+ widgets updating every second, this performance difference is significant.", ts: [9, 25] },
      { role: 'user', content: "That's clean. What about D3.js integration? I've heard it's tricky with React since both want to control the DOM.", ts: [9, 30] },
      { role: 'assistant', content: "You're right — D3 and React both want DOM control. The solution is to let React own the DOM and use D3 only for calculations:\n\n```tsx\nfunction LineChart({ data, width, height }) {\n  const xScale = useMemo(() => d3.scaleTime()\n    .domain(d3.extent(data, d => d.date))\n    .range([0, width]), [data, width]);\n  \n  const yScale = useMemo(() => d3.scaleLinear()\n    .domain([0, d3.max(data, d => d.value)])\n    .range([height, 0]), [data, height]);\n\n  const line = d3.line()\n    .x(d => xScale(d.date))\n    .y(d => yScale(d.value));\n\n  return <path d={line(data)} fill=\"none\" stroke=\"#3b82f6\" />;\n}\n```\n\nUse D3 for scales, layouts, and path generators. Use React for rendering SVG elements. This gives you the best of both worlds — D3's powerful math with React's efficient DOM updates.", ts: [9, 33] },
      { role: 'user', content: "Perfect. One more thing — Mike wants us to add a drag-and-drop layout system so users can rearrange dashboard widgets. Any recommendations?", ts: [10, 0] },
      { role: 'assistant', content: "For drag-and-drop dashboard layouts, I'd recommend **react-grid-layout**. It's battle-tested and specifically designed for dashboard-style resizable, draggable grids:\n\n```tsx\nimport GridLayout from 'react-grid-layout';\n\nconst layout = [\n  { i: 'revenue', x: 0, y: 0, w: 6, h: 4 },\n  { i: 'users', x: 6, y: 0, w: 6, h: 4 },\n  { i: 'health', x: 0, y: 4, w: 12, h: 3 },\n];\n\n<GridLayout layout={layout} cols={12} onLayoutChange={saveLayout}>\n  <div key=\"revenue\"><RevenueChart /></div>\n  <div key=\"users\"><ActiveUsersWidget /></div>\n  <div key=\"health\"><SystemHealthPanel /></div>\n</GridLayout>\n```\n\nPersist the layout to localStorage or your backend so each user's customization is remembered. You can also create preset layouts (\"Engineering View\", \"Executive View\") that users can switch between.", ts: [10, 5] },
      { role: 'user', content: "This is exactly what we need. I'll start with the WebSocket + Zustand setup today and add the grid layout tomorrow. Thanks!", ts: [10, 42] },
      { role: 'assistant', content: "Sounds like a solid plan! A few tips as you build:\n\n1. **Debounce WebSocket updates** — batch updates every 100-200ms to avoid overwhelming React's reconciler\n2. **Add reconnection logic** with exponential backoff for the WebSocket\n3. **Use React.memo** on individual widget components since they receive frequently changing props\n4. **Consider virtualization** if you end up with many off-screen widgets\n\nGood luck with the dashboard! The Zustand + WebSocket pattern will give you a really smooth real-time experience.", ts: [10, 45] },
    ],
    memories: [
      { name: 'Dashboard Architecture Decision', content: 'Building a real-time SaaS analytics dashboard using React with WebSocket for live updates, Zustand for state management (replacing Redux), and D3.js for visualizations.' },
      { name: 'Zustand WebSocket Pattern', content: 'Using Zustand store with WebSocket integration for real-time dashboard. Only components subscribing to specific metrics re-render, unlike Redux which causes unnecessary re-renders across 20+ widgets.' },
      { name: 'D3 React Integration', content: 'Best practice for D3.js in React: let React own the DOM, use D3 only for calculations (scales, layouts, path generators). Never use D3 DOM manipulation methods in React components.' },
      { name: 'Dashboard Layout System', content: 'Using react-grid-layout for drag-and-drop dashboard widget arrangement. Supports resizable panels, preset layouts, and layout persistence to localStorage.' },
    ],
    entities: ['React', 'Zustand', 'D3.js', 'WebSocket', 'Sarah Chen', 'Mike Rodriguez'],
    summary: 'Designed architecture for a real-time SaaS analytics dashboard using React, Zustand for state management, WebSocket for live data, and D3.js for visualizations. Discussed drag-and-drop layouts with react-grid-layout and performance optimization strategies.',
  },
  {
    id: 'ai-healthcare-chatgpt',
    title: 'AI Applications in Healthcare',
    app_name: 'ChatGPT',
    created_at: daysAgo(10, 14, 0),
    updated_at: daysAgo(10, 15, 30),
    messages: [
      { role: 'user', content: "I'm writing a blog post about how AI is transforming healthcare. Can you help me outline the major areas where AI is making the biggest impact?", ts: [14, 0] },
      { role: 'assistant', content: "Here are the major areas where AI is transforming healthcare:\n\n**1. Medical Imaging & Diagnostics**\nAI models can detect cancers, fractures, and retinal diseases from medical images with accuracy matching or exceeding radiologists. Google's DeepMind developed an AI that can detect over 50 eye diseases from retinal scans.\n\n**2. Drug Discovery & Development**\nAI accelerates drug discovery from 10+ years to potentially 2-3 years. Companies like Insilico Medicine used AI to identify a novel drug candidate for fibrosis in just 18 months.\n\n**3. Personalized Treatment Plans**\nMachine learning analyzes patient genetics, lifestyle, and medical history to recommend personalized treatments. This is especially impactful in oncology.\n\n**4. Administrative Automation**\nNLP-powered tools handle medical coding, billing, prior authorizations, and clinical documentation, saving clinicians hours per day.\n\n**5. Predictive Analytics**\nHospitals use AI to predict patient deterioration, readmission risk, and disease outbreaks. Early warning systems have reduced ICU mortality by up to 20%.\n\n**6. Mental Health**\nAI chatbots and digital therapeutics provide accessible mental health support, and NLP analysis of speech patterns can detect early signs of depression.", ts: [14, 3] },
      { role: 'user', content: "This is great. Dr. Priya Sharma from Stanford mentioned in her talk that the diagnostic imaging space is the most mature. Can you give me specific examples with data I can cite?", ts: [14, 10] },
      { role: 'assistant', content: "Dr. Sharma is right — diagnostic imaging is the most FDA-approved AI application in healthcare. Here are citable examples:\n\n**Breast Cancer Detection:**\n- A 2020 Nature study showed Google Health's AI reduced false negatives by 9.4% and false positives by 5.7% in mammography screening\n- The AI was trained on 76,000+ mammograms from the UK and US\n\n**Diabetic Retinopathy:**\n- IDx-DR was the first FDA-authorized autonomous AI diagnostic system (2018)\n- In clinical trials, it achieved 87.2% sensitivity and 90.7% specificity\n- Patients get results in minutes without needing an ophthalmologist\n\n**Lung Cancer:**\n- Google's AI detected lung cancer from CT scans with 94.4% accuracy\n- It outperformed 6 radiologists when no prior scan was available\n- Published in Nature Medicine, 2019\n\n**Skin Cancer:**\n- Stanford researchers trained a CNN that classified skin cancer at dermatologist-level accuracy\n- Trained on 129,450 clinical images across 2,032 diseases\n\nThese are all peer-reviewed and highly citable for your blog post.", ts: [14, 15] },
      { role: 'user', content: "What about the ethical concerns? I want to address those too so the post is balanced.", ts: [14, 25] },
      { role: 'assistant', content: "Smart approach. Here are the key ethical concerns:\n\n**1. Bias in Training Data**\nAI models trained predominantly on data from one demographic can perform poorly on others. A famous example: a dermatology AI trained mostly on light-skinned patients had significantly lower accuracy for darker skin tones.\n\n**2. Privacy & Data Security**\nHealthcare AI requires massive amounts of patient data. HIPAA compliance, data anonymization, and the risk of re-identification are ongoing challenges.\n\n**3. The \"Black Box\" Problem**\nMany AI models can't explain their reasoning. In healthcare, a doctor needs to understand WHY a diagnosis was made, not just what it is. Explainable AI (XAI) is an active research area.\n\n**4. Liability & Accountability**\nIf an AI misdiagnoses a patient, who is liable? The developer? The hospital? The physician who relied on it? Legal frameworks haven't caught up.\n\n**5. Workforce Impact**\nConcerns that AI will replace radiologists and pathologists. In reality, it's more likely to augment their capabilities — \"AI won't replace doctors, but doctors who use AI will replace those who don't.\"\n\n**6. Access Inequality**\nAdvanced AI diagnostics could widen the gap between well-funded hospitals and under-resourced clinics, particularly in developing countries.", ts: [14, 30] },
      { role: 'user', content: "Great, I'll structure the blog as: Introduction → Major Applications (with data) → Ethical Concerns → Future Outlook. Can you help with a compelling introduction?", ts: [14, 45] },
      { role: 'assistant', content: "Here's a compelling opening:\n\n---\n\n**Title: How AI Is Quietly Revolutionizing Healthcare — And Why It Matters**\n\nEvery 36 seconds, someone in the United States dies from cardiovascular disease. Every year, diagnostic errors affect approximately 12 million Americans. These aren't just statistics — they represent a systemic challenge that human capability alone cannot solve.\n\nEnter artificial intelligence. Not the sci-fi version that replaces doctors, but a practical, already-deployed technology that catches the cancers radiologists miss at 2 AM, predicts which ICU patients will deteriorate hours before it happens, and discovers drug candidates in months instead of decades.\n\nThe AI healthcare revolution isn't coming — it's already here. And it's saving lives.\n\n---\n\nThis opening uses specific data points to create urgency, addresses the common \"AI replacing doctors\" fear immediately, and sets up the practical focus of the rest of the article.", ts: [14, 50] },
    ],
    memories: [
      { name: 'Healthcare AI Applications', content: 'Six major areas where AI transforms healthcare: medical imaging diagnostics, drug discovery, personalized treatment, admin automation, predictive analytics, and mental health support.' },
      { name: 'AI Diagnostic Accuracy', content: 'Google Health AI reduced mammography false negatives by 9.4%. IDx-DR was first FDA-authorized autonomous AI diagnostic. Google lung cancer detection achieved 94.4% accuracy from CT scans.' },
      { name: 'Healthcare AI Ethics', content: 'Key ethical concerns in healthcare AI: training data bias across demographics, black box problem for medical decisions, liability for misdiagnosis, and access inequality between well-funded and under-resourced clinics.' },
    ],
    entities: ['Dr. Priya Sharma', 'Machine Learning', 'Healthcare AI'],
    summary: 'Research session for a blog post on AI in healthcare. Covered six major application areas with citable data points, ethical concerns including bias and accountability, and crafted a compelling introduction for the article.',
  },
  {
    id: 'event-driven-ecommerce-claude-web',
    title: 'Event-Driven Architecture for E-Commerce',
    app_name: 'Claude.ai-browser',
    created_at: daysAgo(7, 11, 0),
    updated_at: daysAgo(7, 12, 30),
    messages: [
      { role: 'user', content: "We're redesigning our e-commerce platform from a monolith to microservices. The team is leaning toward event-driven architecture with Kafka. Can you help us think through the design?", ts: [11, 0] },
      { role: 'assistant', content: "Event-driven architecture (EDA) is an excellent choice for e-commerce. Here's a high-level design:\n\n**Core Services & Their Events:**\n\n1. **Order Service** → emits: OrderPlaced, OrderConfirmed, OrderCancelled\n2. **Inventory Service** → emits: StockReserved, StockReleased, LowStockAlert\n3. **Payment Service** → emits: PaymentProcessed, PaymentFailed, RefundIssued\n4. **Shipping Service** → emits: ShipmentCreated, ShipmentDelivered\n5. **Notification Service** → consumes events, sends emails/SMS/push\n\n**Event Flow for a Purchase:**\n```\nUser places order → OrderPlaced event\n  → Inventory Service reserves stock (StockReserved)\n  → Payment Service charges card (PaymentProcessed)\n  → Order Service confirms (OrderConfirmed)\n  → Shipping Service creates shipment (ShipmentCreated)\n  → Notification Service emails confirmation\n```\n\n**Kafka Topics Structure:**\n- `orders.placed`, `orders.confirmed`, `orders.cancelled`\n- `payments.processed`, `payments.failed`\n- `inventory.reserved`, `inventory.released`\n- `shipping.created`, `shipping.delivered`\n\nEach service only consumes the events it cares about.", ts: [11, 5] },
      { role: 'user', content: "How do we handle failures? Like if payment fails after inventory is reserved?", ts: [11, 15] },
      { role: 'assistant', content: "This is the classic **Saga pattern** problem. For e-commerce, I recommend the **Choreography-based Saga**:\n\n**Compensating Transactions:**\nEvery action has a corresponding undo action:\n- StockReserved → compensate with StockReleased\n- PaymentProcessed → compensate with RefundIssued\n- OrderConfirmed → compensate with OrderCancelled\n\n**Payment Failure Flow:**\n```\nOrderPlaced → StockReserved → PaymentFailed\n  → Inventory Service hears PaymentFailed\n  → Releases reserved stock (StockReleased)\n  → Order Service marks order as failed\n  → Notification Service alerts customer\n```\n\n**Key Resilience Patterns:**\n1. **Idempotency**: Every event handler must be idempotent — processing the same event twice should have the same result\n2. **Dead Letter Queue**: Failed events go to a DLQ for manual review\n3. **Event Sourcing**: Store all events as the source of truth, rebuild state by replaying\n4. **Circuit Breaker**: If a downstream service is failing, stop sending requests and fail fast\n\nThe Saga pattern ensures eventual consistency without requiring distributed transactions.", ts: [11, 20] },
      { role: 'user', content: "Should we also implement CQRS? Our read and write patterns are very different — lots of catalog browsing vs. occasional purchases.", ts: [11, 30] },
      { role: 'assistant', content: "Yes, CQRS (Command Query Responsibility Segregation) is a natural fit for your use case:\n\n**Write Side (Commands):**\n- PostgreSQL for transactional data (orders, payments, inventory)\n- Strong consistency for writes\n- Normalized schema for data integrity\n\n**Read Side (Queries):**\n- Elasticsearch for product catalog search (full-text, faceted search)\n- Redis for frequently accessed data (product details, cart, sessions)\n- Materialized views for analytics dashboards\n\n**Sync Mechanism:**\nKafka acts as the bridge. When a product is updated on the write side:\n```\nProduct updated in PostgreSQL\n  → ProductUpdated event to Kafka\n  → Elasticsearch consumer updates search index\n  → Redis consumer updates cache\n```\n\n**Benefits for your case:**\n- Catalog browsing (95% of traffic) hits fast read stores\n- Purchases (5% of traffic) hit the transactional DB\n- Each store is optimized for its access pattern\n- You can scale read and write independently\n\n**Caveat:** Eventual consistency means a just-updated product price might take 100-500ms to appear in search. For most e-commerce, this is acceptable.", ts: [11, 35] },
      { role: 'user', content: "This is incredibly helpful. What about monitoring and observability for all these distributed services?", ts: [11, 50] },
      { role: 'assistant', content: "Observability is critical in distributed systems. Here's a three-pillar approach:\n\n**1. Distributed Tracing (Jaeger/Zipkin)**\n- Assign a correlation ID to every event at the entry point\n- Pass it through all services via Kafka headers\n- Trace the full lifecycle of an order across 5+ services\n- Visualize the flow: Order → Inventory → Payment → Shipping\n\n**2. Metrics (Prometheus + Grafana)**\n- Event throughput per topic (events/sec)\n- Consumer lag per service (how far behind is each consumer?)\n- Service latency (p50, p95, p99)\n- Business metrics: orders/minute, payment success rate, avg fulfillment time\n\n**3. Centralized Logging (ELK Stack)**\n- Structured JSON logs with correlation IDs\n- Log every event consumption and production\n- Set up alerts for: consumer lag > threshold, error rate spikes, DLQ messages\n\n**Kafka-Specific Monitoring:**\n- Use Kafka's consumer group lag to detect slow consumers\n- Monitor partition balance across brokers\n- Alert on under-replicated partitions\n\nI'd also recommend creating a **service dependency map** that auto-generates from your event subscriptions — it becomes your living architecture diagram.", ts: [12, 0] },
    ],
    memories: [
      { name: 'E-Commerce Event Architecture', content: 'Designing e-commerce platform with event-driven architecture using Kafka. Five core services: Order, Inventory, Payment, Shipping, Notification. Each service emits and consumes domain events through dedicated Kafka topics.' },
      { name: 'Saga Pattern for Failures', content: 'Using choreography-based Saga pattern for distributed transaction handling. Every action has compensating transaction. Payment failure triggers automatic stock release and order cancellation through event chain.' },
      { name: 'CQRS for E-Commerce', content: 'Implementing CQRS: PostgreSQL for writes (5% traffic), Elasticsearch for catalog search and Redis for caching on read side (95% traffic). Kafka bridges write-to-read sync with 100-500ms eventual consistency.' },
      { name: 'Distributed Observability', content: 'Three-pillar observability for microservices: distributed tracing with correlation IDs through Kafka headers, Prometheus+Grafana for metrics, and ELK stack for centralized logging.' },
    ],
    entities: ['Kafka', 'PostgreSQL', 'Redis', 'Docker', 'Microservices', 'Event-Driven Architecture', 'CQRS Pattern'],
    summary: 'System design session for migrating e-commerce monolith to event-driven microservices with Kafka. Covered service decomposition, Saga pattern for failure handling, CQRS for separating read/write workloads, and distributed observability strategy.',
  },
  {
    id: 'japan-trip-gemini',
    title: 'Planning a Two-Week Trip to Japan',
    app_name: 'Gemini',
    created_at: daysAgo(6, 20, 0),
    updated_at: daysAgo(6, 21, 15),
    messages: [
      { role: 'user', content: "I'm planning a 2-week trip to Japan in April for cherry blossom season. It'll be my first time. I want to visit Tokyo, Kyoto, and Osaka. Can you help me plan an itinerary?", ts: [20, 0] },
      { role: 'assistant', content: "April is the perfect time for Japan! Cherry blossoms typically peak in late March to mid-April. Here's a suggested 14-day itinerary:\n\n**Tokyo (Days 1-5)**\n- Day 1: Arrive, Shibuya Crossing, Meiji Shrine, Harajuku\n- Day 2: Asakusa (Senso-ji), Tokyo Skytree, Akihabara\n- Day 3: Shinjuku Gyoen (cherry blossoms!), Golden Gai, Kabukicho\n- Day 4: Tsukiji Outer Market, teamLab Borderless, Odaiba\n- Day 5: Day trip to Kamakura (Great Buddha, bamboo grove)\n\n**Kyoto (Days 6-10)**\n- Day 6: Travel by Shinkansen (2.5 hrs), Fushimi Inari\n- Day 7: Arashiyama Bamboo Grove, Monkey Park, Togetsukyo Bridge\n- Day 8: Kinkaku-ji, Ryoan-ji, Nijo Castle\n- Day 9: Philosopher's Path (stunning cherry blossoms), Ginkaku-ji, Nanzen-ji\n- Day 10: Geisha district (Gion), tea ceremony experience, Pontocho alley\n\n**Osaka (Days 11-13)**\n- Day 11: Travel to Osaka (15 min), Osaka Castle, Dotonbori\n- Day 12: Shinsekai, Kuromon Market, street food tour\n- Day 13: Day trip to Nara (deer park, Todai-ji Temple)\n\n**Day 14: Departure from Osaka (KIX)**\n\nGet a **14-day Japan Rail Pass** — it covers all Shinkansen and JR trains and pays for itself with just the Tokyo↔Kyoto round trip.", ts: [20, 5] },
      { role: 'user', content: "This looks amazing! What's a realistic daily budget? I'm comfortable with mid-range travel — nice but not luxury.", ts: [20, 15] },
      { role: 'assistant', content: "Here's a realistic mid-range daily budget:\n\n**Accommodation: ¥10,000-15,000/night ($70-100)**\n- Business hotels (Toyoko Inn, APA Hotel): clean, reliable, great locations\n- One or two nights in a traditional ryokan in Kyoto: ¥20,000-30,000 (worth the splurge!)\n\n**Food: ¥4,000-6,000/day ($25-40)**\n- Breakfast: ¥500-800 (convenience store or hotel)\n- Lunch: ¥800-1,500 (ramen, curry, bento, udon)\n- Dinner: ¥2,000-4,000 (izakaya, sushi, yakitori)\n- Japan's mid-range dining quality is exceptional — ¥1,000 ramen rivals expensive restaurants elsewhere\n\n**Transport: ¥2,000-3,000/day ($15-20)**\n- 14-day JR Pass: ¥50,000 (~¥3,500/day, covers intercity + many local trains)\n- Subway/bus: ¥500-1,000/day for non-JR lines\n- Get a Suica/Pasmo IC card for tap-and-go convenience\n\n**Activities: ¥1,500-3,000/day ($10-20)**\n- Most temples: ¥300-600\n- Museums: ¥500-1,500\n- Tea ceremony: ¥2,000-4,000\n\n**Daily Total: ~¥18,000-27,000 ($120-180)**\n**14-day Total: ~$1,700-2,500** (excluding flights and JR Pass)\n\nJapan is surprisingly affordable for the quality you get.", ts: [20, 20] },
      { role: 'user', content: "What are your must-try food recommendations? I want the authentic local experience, not tourist traps.", ts: [20, 35] },
      { role: 'assistant', content: "Here are my top authentic food experiences by city:\n\n**Tokyo:**\n- **Ramen at a local shop** in Shinjuku or Ebisu (not chain stores). Look for places with a ticket vending machine outside — that's a sign of authenticity\n- **Sushi at Tsukiji Outer Market** — stand-up sushi bars with fish that was swimming hours ago\n- **Yakitori under the train tracks** in Yurakucho — tiny smoky stalls, incredible grilled chicken skewers\n- **Depachika** (department store basement food halls) — Isetan Shinjuku has the best\n\n**Kyoto:**\n- **Kaiseki** (multi-course traditional dinner) — splurge on one meal at a local ryokan\n- **Matcha everything** in Uji (20 min from Kyoto) — the birthplace of Japanese green tea\n- **Yudofu** (hot tofu) near Nanzen-ji — sounds simple but it's transcendent\n- **Nishiki Market** — \"Kyoto's Kitchen,\" graze through pickles, mochi, and seafood\n\n**Osaka (the food capital!):**\n- **Takoyaki** (octopus balls) in Dotonbori — watch them made fresh\n- **Okonomiyaki** at Mizuno or Fukutaro — savory pancakes cooked on a griddle in front of you\n- **Kushikatsu** in Shinsekai — deep-fried skewers, never double-dip!\n- **Street food crawl** through Kuromon Market — tuna sashimi, grilled scallops, fresh uni\n\n**Pro tip:** Download Tabelog (Japan's Yelp) — anything rated 3.5+ is genuinely excellent.", ts: [20, 40] },
    ],
    memories: [
      { name: 'Japan Itinerary', content: 'Planned 14-day Japan trip for cherry blossom season in April: 5 days Tokyo, 5 days Kyoto, 3 days Osaka. Key spots include Shinjuku Gyoen and Philosopher\'s Path for cherry blossoms.' },
      { name: 'Japan Travel Budget', content: 'Mid-range Japan travel budget: $120-180/day. 14-day total $1,700-2,500 excluding flights. Get 14-day JR Pass for ¥50,000. Business hotels ¥10,000-15,000/night.' },
      { name: 'Japan Food Guide', content: 'Must-try: Tokyo yakitori under Yurakucho tracks, Tsukiji stand-up sushi bars. Kyoto kaiseki and matcha in Uji. Osaka takoyaki in Dotonbori, okonomiyaki at Mizuno. Use Tabelog app for restaurant ratings.' },
    ],
    entities: ['Tokyo', 'Kyoto'],
    summary: 'Planned a detailed 14-day Japan itinerary for cherry blossom season: 5 days Tokyo, 5 days Kyoto, 3 days Osaka. Covered daily budget ($120-180), transportation (JR Pass), and authentic food recommendations for each city.',
  },
  {
    id: 'nodejs-memory-leaks-claude-desktop',
    title: 'Debugging Node.js Memory Leaks in Production',
    app_name: 'Claude Desktop',
    created_at: daysAgo(5, 16, 0),
    updated_at: daysAgo(5, 17, 15),
    messages: [
      { role: 'user', content: "Our Node.js production server's memory usage keeps growing. It starts at 200MB and reaches 1.5GB after 24 hours, then crashes. I've been trying to debug this for two days. Where should I start?", ts: [16, 0] },
      { role: 'assistant', content: "Memory leaks in Node.js production are tricky but systematic. Here's a debugging strategy:\n\n**Step 1: Take Heap Snapshots**\n```javascript\n// Add this endpoint to your server\nconst v8 = require('v8');\nconst fs = require('fs');\n\napp.get('/debug/heapdump', (req, res) => {\n  const snapshotPath = `/tmp/heap-${Date.now()}.heapsnapshot`;\n  const stream = v8.writeHeapSnapshot(snapshotPath);\n  res.json({ path: stream });\n});\n```\n\nTake snapshots at: startup, after 1 hour, and after 4 hours. Compare them in Chrome DevTools → Memory tab.\n\n**Step 2: Check the Usual Suspects**\n1. **Event listeners accumulating** — the #1 cause\n2. **Global variables/caches without eviction**\n3. **Closures holding references to large objects**\n4. **Unfinished promises or streams**\n5. **Database connection pool leaks**\n\n**Step 3: Add Memory Monitoring**\n```javascript\nsetInterval(() => {\n  const mem = process.memoryUsage();\n  console.log({\n    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + ' MB',\n    rss: (mem.rss / 1024 / 1024).toFixed(2) + ' MB',\n    external: (mem.external / 1024 / 1024).toFixed(2) + ' MB',\n  });\n}, 60000);\n```\n\nWatch whether `heapUsed` or `external` is growing — they point to different leak types.", ts: [16, 5] },
      { role: 'user', content: "I found the issue! We're adding event listeners inside a request handler but never removing them. Every API call adds a new listener to our Redis pub/sub client.", ts: [16, 30] },
      { role: 'assistant', content: "Classic! This is the #1 Node.js memory leak pattern. Here's what's happening:\n\n```javascript\n// BAD — listener accumulates on every request\napp.get('/updates', (req, res) => {\n  redisClient.on('message', (channel, message) => {\n    // This listener is NEVER removed\n    // After 10,000 requests = 10,000 listeners!\n  });\n});\n```\n\n**The Fix:**\n```javascript\n// GOOD — clean up on disconnect\napp.get('/updates', (req, res) => {\n  const handler = (channel, message) => {\n    res.write(`data: ${message}\\n\\n`);\n  };\n  \n  redisClient.on('message', handler);\n  \n  req.on('close', () => {\n    redisClient.removeListener('message', handler);\n  });\n});\n```\n\n**Additional Safeguards:**\n1. Set `emitter.setMaxListeners(20)` — Node warns at 10 by default, but setting an explicit limit helps catch leaks early\n2. Add a monitoring check:\n```javascript\nsetInterval(() => {\n  const count = redisClient.listenerCount('message');\n  if (count > 50) console.warn(`Listener leak detected: ${count} listeners`);\n}, 30000);\n```\n3. Consider using a single shared listener that dispatches to active connections via a Map, rather than adding per-request listeners.\n\nThis pattern of listener accumulation accounts for ~60% of Node.js memory leaks I've encountered.", ts: [16, 35] },
      { role: 'user', content: "Fixed it. Memory is stable now at 250MB after 6 hours. Thanks! Any other common patterns I should watch out for?", ts: [17, 0] },
      { role: 'assistant', content: "Great fix! Here are other common Node.js memory leak patterns to watch for:\n\n**1. Closure Leaks**\n```javascript\n// BAD — closure keeps reference to large `data` even after processing\nfunction processData(data) {\n  const bigBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB\n  return () => {\n    // This closure keeps bigBuffer alive forever\n    console.log(data.id);\n  };\n}\n```\n\n**2. Global Cache Without Eviction**\n```javascript\n// BAD — grows forever\nconst cache = {};\napp.get('/user/:id', (req, res) => {\n  cache[req.params.id] = getUserData(req.params.id);\n});\n\n// GOOD — use LRU cache\nconst LRU = require('lru-cache');\nconst cache = new LRU({ max: 500 });\n```\n\n**3. Unhandled Promise Rejections**\nUnresolved promises and their associated closures stay in memory.\n\n**4. Timer Leaks**\n```javascript\n// BAD — setInterval never cleared\nfunction startPolling() {\n  setInterval(pollAPI, 5000); // if called multiple times...\n}\n```\n\n**5. Stream Backpressure**\nWritable streams that aren't consumed cause buffered data to accumulate.\n\n**Pro tip:** Run your Node.js process with `--max-old-space-size=512` in production to force crashes earlier during development, making leaks obvious sooner.", ts: [17, 10] },
    ],
    memories: [
      { name: 'Node.js Memory Debugging', content: 'Debug Node.js memory leaks using v8.writeHeapSnapshot() to take heap snapshots. Compare snapshots at startup, 1 hour, and 4 hours in Chrome DevTools Memory tab. Monitor process.memoryUsage() to distinguish heap vs external leaks.' },
      { name: 'Event Listener Leak Fix', content: 'Most common Node.js memory leak: adding event listeners inside request handlers without cleanup. Fix by removing listener on req close event. Pattern accounts for ~60% of Node.js memory leaks.' },
      { name: 'Node.js Leak Patterns', content: 'Common Node.js memory leak patterns: closure leaks holding large buffers, global caches without LRU eviction, unhandled promise rejections, uncleaned setInterval timers, and stream backpressure buildup.' },
    ],
    entities: ['Node.js', 'Redis'],
    summary: 'Debugging session for a Node.js production memory leak. Identified root cause: event listeners accumulating on Redis pub/sub client inside request handlers. Fixed by cleaning up listeners on connection close. Covered heap snapshot analysis and common leak patterns.',
  },
  {
    id: 'quantum-computing-chatgpt',
    title: 'Understanding Quantum Computing Fundamentals',
    app_name: 'ChatGPT',
    created_at: daysAgo(3, 10, 0),
    updated_at: daysAgo(3, 11, 20),
    messages: [
      { role: 'user', content: "I keep hearing about quantum computing but I don't really understand how it works beyond the surface level. Can you explain it like I'm a software engineer who understands classical computing well?", ts: [10, 0] },
      { role: 'assistant', content: "Perfect framing — let me bridge from classical to quantum:\n\n**Classical Computing:**\n- A bit is either 0 or 1\n- Operations process one state at a time\n- n bits = one state out of 2^n possible states\n\n**Quantum Computing:**\n- A qubit can be in a **superposition** of 0 AND 1 simultaneously\n- Think of it like a coin spinning in the air — it's both heads and tails until it lands\n- n qubits = processing 2^n states **simultaneously**\n\n**Why This Matters:**\n- 50 qubits can represent 2^50 = ~1 quadrillion states at once\n- A classical computer would need 1 petabyte of RAM to simulate this\n- Certain problems become exponentially faster\n\n**The Catch:**\nWhen you \"measure\" a qubit (read its value), the superposition collapses to either 0 or 1. The art of quantum computing is designing algorithms that make the right answer more probable when you measure.\n\n**Key Quantum Properties:**\n1. **Superposition**: Qubits exist in multiple states simultaneously\n2. **Entanglement**: Two qubits can be correlated — measuring one instantly determines the other, regardless of distance\n3. **Interference**: Quantum states can amplify correct answers and cancel wrong ones (like noise-canceling headphones for computation)\n\nThink of it as: classical computing explores a maze one path at a time, quantum computing explores all paths simultaneously and uses interference to highlight the exit.", ts: [10, 5] },
      { role: 'user', content: "That maze analogy is great. What practical problems can quantum computers solve that classical can't?", ts: [10, 20] },
      { role: 'assistant', content: "Here are the killer applications, ranked by nearness to practical impact:\n\n**1. Cryptography (Shor's Algorithm)**\n- Can factor large numbers exponentially faster than classical computers\n- RSA-2048 encryption: classical = billions of years, quantum = hours\n- This is why NIST is already standardizing post-quantum cryptography\n- Timeline: 10-15 years for a quantum computer powerful enough\n\n**2. Drug Discovery & Material Science (Molecular Simulation)**\n- Simulating molecular interactions is naturally quantum mechanical\n- Classical computers can't accurately simulate molecules with >50 atoms\n- Quantum computers could design new drugs, catalysts, and materials from scratch\n- This is where companies like Google and IBM are focusing\n\n**3. Optimization Problems (Quantum Annealing)**\n- Supply chain routing, financial portfolio optimization, airline scheduling\n- Problems with millions of variables and constraints\n- D-Wave already sells quantum annealers for these use cases\n\n**4. Machine Learning (Quantum ML)**\n- Quantum kernels could find patterns in high-dimensional data faster\n- Still very theoretical but IBM and Google have published promising results\n- Don't expect quantum GPT anytime soon — it's more about specific ML subroutines\n\n**5. Search (Grover's Algorithm)**\n- Searches unsorted databases in √n time instead of n\n- Quadratic speedup, not exponential, but useful for specific applications\n\n**What quantum CANNOT do:**\n- Make your web app faster\n- Replace classical computing for everyday tasks\n- Solve NP-hard problems in polynomial time (common misconception)", ts: [10, 25] },
      { role: 'user', content: "As a software engineer, how can I start experimenting with quantum computing?", ts: [10, 45] },
      { role: 'assistant', content: "Great news — you can start today, no physics PhD required:\n\n**1. IBM Qiskit (Python) — Best Starting Point**\n```python\nfrom qiskit import QuantumCircuit, transpile\nfrom qiskit_aer import AerSimulator\n\nqc = QuantumCircuit(2, 2)\nqc.h(0)          # Put qubit 0 in superposition\nqc.cx(0, 1)      # Entangle qubit 0 and 1\nqc.measure([0,1], [0,1])  # Measure both\n\nsim = AerSimulator()\nresult = sim.run(transpile(qc, sim), shots=1000).result()\nprint(result.get_counts())  # {'00': ~500, '11': ~500}\n```\nThis creates a Bell state — two entangled qubits that always agree.\n\n**2. Run on Real Quantum Hardware**\n- IBM Quantum provides free access to 127-qubit processors\n- Sign up at quantum-computing.ibm.com\n- Queue your circuits and get real quantum results\n\n**3. Learning Path:**\n- IBM Quantum Learning: free interactive courses\n- \"Quantum Computing: An Applied Approach\" by Hidary\n- Microsoft's Quantum Katas: hands-on exercises\n\n**4. Other Frameworks:**\n- Google Cirq (Python)\n- Amazon Braket (access to multiple quantum hardware providers)\n- Microsoft Q# (C#-like syntax)\n\n**Mental Model Shift:**\nThe hardest part isn't the tools — it's thinking quantumly. You're not writing IF/ELSE logic. You're designing interference patterns that make correct answers louder and wrong answers quieter.", ts: [11, 0] },
    ],
    memories: [
      { name: 'Quantum Computing Basics', content: 'Quantum computing uses superposition (qubits in multiple states), entanglement (correlated qubits), and interference (amplify correct answers). 50 qubits process 2^50 states simultaneously — equivalent to 1 petabyte classical RAM.' },
      { name: 'Quantum Applications', content: 'Key quantum computing applications: cryptography breaking (Shor\'s algorithm, 10-15 years away), molecular simulation for drug discovery, optimization problems, and quantum ML subroutines. Cannot make everyday apps faster or solve NP-hard in polynomial time.' },
      { name: 'Quantum Dev Tools', content: 'Start quantum programming with IBM Qiskit (Python). Free access to 127-qubit real hardware at IBM Quantum. Also available: Google Cirq, Amazon Braket, Microsoft Q#.' },
    ],
    entities: ['Quantum Computing', 'Machine Learning'],
    summary: 'Deep dive into quantum computing fundamentals for software engineers. Covered qubits, superposition, entanglement, and interference. Discussed practical applications: cryptography, drug discovery, optimization. Explored starting tools like IBM Qiskit with free hardware access.',
  },
  {
    id: 'postgresql-optimization-claude-desktop',
    title: 'PostgreSQL Query Optimization Strategies',
    app_name: 'Claude Desktop',
    created_at: daysAgo(2, 9, 0),
    updated_at: daysAgo(2, 10, 30),
    messages: [
      { role: 'user', content: "Our main PostgreSQL query is taking 12 seconds on a table with 50M rows. It's a product search with multiple filters. Here's the query:\n\nSELECT * FROM products\nWHERE category = 'electronics'\nAND price BETWEEN 100 AND 500\nAND rating >= 4.0\nAND created_at > '2024-01-01'\nORDER BY popularity DESC\nLIMIT 20;", ts: [9, 0] },
      { role: 'assistant', content: "12 seconds on 50M rows is definitely fixable. Let's diagnose:\n\n**Step 1: Run EXPLAIN ANALYZE**\n```sql\nEXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)\nSELECT * FROM products\nWHERE category = 'electronics'\n  AND price BETWEEN 100 AND 500\n  AND rating >= 4.0\n  AND created_at > '2024-01-01'\nORDER BY popularity DESC\nLIMIT 20;\n```\n\n**What to look for:**\n- `Seq Scan` = no index being used (bad for 50M rows)\n- `Rows Removed by Filter` = scanning many rows to find few matches\n- `Sort Method: external merge` = sort spilling to disk\n\n**Likely solution: Composite Index**\n```sql\nCREATE INDEX CONCURRENTLY idx_products_search\nON products (category, rating, created_at)\nINCLUDE (price, popularity)\nWHERE category IS NOT NULL;\n```\n\nWhy this index works:\n1. `category` first — exact match narrows to ~5M rows\n2. `rating` second — range condition further filters\n3. `created_at` third — another range filter\n4. `INCLUDE` columns avoid table lookups for the sort and filter\n5. Partial index (`WHERE category IS NOT NULL`) reduces index size\n\n**Use CONCURRENTLY** to avoid locking the table in production.\n\nRun EXPLAIN ANALYZE after creating the index to compare.", ts: [9, 5] },
      { role: 'user', content: "Great, the composite index brought it down to 800ms. But we need it under 100ms for our API SLA. What else can we do?", ts: [9, 30] },
      { role: 'assistant', content: "From 12s to 800ms is great progress! To get under 100ms, try these techniques:\n\n**1. Covering Index (Index-Only Scan)**\nInclude ALL returned columns in the index to avoid heap fetches:\n```sql\nCREATE INDEX CONCURRENTLY idx_products_covering\nON products (category, rating DESC, created_at DESC)\nINCLUDE (name, price, popularity, image_url, description);\n```\nThis enables an **index-only scan** — PostgreSQL never touches the table.\n\n**2. Don't SELECT ***\n```sql\nSELECT id, name, price, rating, image_url\nFROM products\nWHERE ...\n```\nFewer columns = smaller rows = more rows fit in cache.\n\n**3. Materialized View for Hot Queries**\n```sql\nCREATE MATERIALIZED VIEW popular_electronics AS\nSELECT id, name, price, rating, popularity, image_url\nFROM products\nWHERE category = 'electronics'\n  AND rating >= 4.0\n  AND created_at > CURRENT_DATE - INTERVAL '1 year';\n\nCREATE INDEX idx_pop_elec ON popular_electronics (price, popularity DESC);\n\n-- Refresh periodically\nREFRESH MATERIALIZED VIEW CONCURRENTLY popular_electronics;\n```\n\n**4. Connection-Level Optimizations**\n```sql\nSET work_mem = '256MB';  -- for this session\n-- Prevents sort spilling to disk\n```\n\n**5. Table Partitioning by created_at**\nPartition by month/quarter — query planner will skip irrelevant partitions:\n```sql\nCREATE TABLE products (\n  ...\n) PARTITION BY RANGE (created_at);\n```\n\nCombining covering index + materialized view should get you well under 100ms.", ts: [9, 40] },
      { role: 'user', content: "The covering index with specific columns got us to 45ms! Is there anything I should know about maintaining these indexes long-term?", ts: [10, 10] },
      { role: 'assistant', content: "45ms is excellent! Here's your index maintenance playbook:\n\n**1. Monitor Index Health**\n```sql\n-- Check index size and usage\nSELECT\n  schemaname, tablename, indexname,\n  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,\n  idx_scan as times_used,\n  idx_tup_read as rows_read\nFROM pg_stat_user_indexes\nWHERE tablename = 'products'\nORDER BY idx_scan DESC;\n```\n\n**2. Detect Index Bloat**\nAfter heavy UPDATE/DELETE operations, indexes accumulate dead tuples:\n```sql\n-- Rebuild bloated indexes (takes a lock, use CONCURRENTLY)\nREINDEX INDEX CONCURRENTLY idx_products_covering;\n```\nSchedule this monthly during low-traffic periods.\n\n**3. Autovacuum Tuning**\nFor a 50M row table, adjust autovacuum to be more aggressive:\n```sql\nALTER TABLE products SET (\n  autovacuum_vacuum_scale_factor = 0.01,  -- default 0.2\n  autovacuum_analyze_scale_factor = 0.005  -- default 0.1\n);\n```\n\n**4. Watch for Unused Indexes**\nEvery index slows down INSERT/UPDATE. Drop indexes with `idx_scan = 0` after a full business cycle (at least one month).\n\n**5. pg_stat_statements Extension**\n```sql\nCREATE EXTENSION IF NOT EXISTS pg_stat_statements;\n\n-- Find your slowest queries\nSELECT query, calls, mean_exec_time, total_exec_time\nFROM pg_stat_statements\nORDER BY mean_exec_time DESC\nLIMIT 20;\n```\n\nThis is your single most valuable PostgreSQL monitoring tool.", ts: [10, 20] },
    ],
    memories: [
      { name: 'PostgreSQL Index Strategy', content: 'For multi-filter queries on large tables: create composite index with exact-match columns first, then range columns. Use INCLUDE for covering indexes to enable index-only scans. Always use CONCURRENTLY in production.' },
      { name: 'Query Optimization Results', content: 'Optimized 50M row PostgreSQL query from 12 seconds to 45ms using covering index with specific columns. Techniques: composite indexes, avoid SELECT *, materialized views, and work_mem tuning.' },
      { name: 'PostgreSQL Maintenance', content: 'Monitor index health via pg_stat_user_indexes. Rebuild bloated indexes monthly with REINDEX CONCURRENTLY. Tune autovacuum for large tables. Use pg_stat_statements to find slow queries.' },
    ],
    entities: ['PostgreSQL', 'TypeScript'],
    summary: 'Optimized a slow PostgreSQL product search query from 12 seconds to 45ms on a 50M row table. Used composite indexes, covering indexes for index-only scans, and discussed long-term maintenance including autovacuum tuning and bloat detection.',
  },
  {
    id: 'book-recommendations-chatgpt',
    title: 'Book Recommendations for Software Engineers',
    app_name: 'ChatGPT',
    created_at: daysAgo(1, 19, 0),
    updated_at: daysAgo(1, 20, 0),
    messages: [
      { role: 'user', content: "I want to read more this year. Can you recommend books across technical, leadership, and general non-fiction that would be valuable for a senior software engineer?", ts: [19, 0] },
      { role: 'assistant', content: "Here's a curated list across categories:\n\n**Technical (Deepening Craft):**\n1. **\"Designing Data-Intensive Applications\"** by Martin Kleppmann — the definitive guide to distributed systems, databases, and data pipelines. Essential reading for anyone building at scale.\n2. **\"A Philosophy of Software Design\"** by John Ousterhout — short, opinionated, and brilliant on managing complexity. The concept of \"deep modules\" will change how you think about API design.\n3. **\"Staff Engineer\"** by Will Larson — practical guide to the staff+ engineering path, with real stories from staff engineers at top companies.\n\n**Leadership & Communication:**\n4. **\"The Manager's Path\"** by Camille Fournier — even if you don't want to manage, understanding your manager's perspective makes you more effective.\n5. **\"Crucial Conversations\"** by Patterson et al. — how to have difficult conversations at work without damaging relationships.\n6. **\"An Elegant Puzzle\"** by Will Larson — systems thinking applied to engineering management.\n\n**Non-Fiction (Broader Thinking):**\n7. **\"Thinking, Fast and Slow\"** by Daniel Kahneman — understanding cognitive biases directly improves debugging, code review, and decision-making.\n8. **\"Range\"** by David Epstein — argues that generalists often outperform specialists. Relevant for the T-shaped engineer debate.\n9. **\"The Pragmatic Programmer\"** (20th Anniversary Edition) — updated classic, still remarkably relevant.\n\nIf I had to pick just one: **\"Designing Data-Intensive Applications.\"** It's the book I wish I'd read five years earlier.", ts: [19, 5] },
      { role: 'user', content: "I've already read DDIA and loved it. What about fiction? I find that reading fiction makes me a better communicator and more creative problem solver.", ts: [19, 20] },
      { role: 'assistant', content: "Absolutely agree — fiction builds empathy and creative thinking. Here are fiction picks that particularly resonate with technical minds:\n\n**Science Fiction (Ideas that Expand Thinking):**\n1. **\"Project Hail Mary\"** by Andy Weir — an engineer's approach to problem-solving in space. The protagonist debugs the universe like a senior engineer debugging production.\n2. **\"Exhalation\"** by Ted Chiang — short stories exploring consciousness, free will, and technology. \"Story of Your Life\" (the story behind Arrival) is a masterpiece.\n3. **\"The Three-Body Problem\"** by Liu Cixin — hard sci-fi that genuinely challenges how you think about computation, physics, and civilization-scale problems.\n\n**Literary Fiction (Empathy & Craft):**\n4. **\"Klara and the Sun\"** by Kazuo Ishiguro — an AI narrator observing human relationships. Beautifully written and thought-provoking about what artificial intelligence means.\n5. **\"Tomorrow, and Tomorrow, and Tomorrow\"** by Gabrielle Zevin — about two friends who design video games together. Captures the creative partnership of building something together.\n\n**Classics for Engineers:**\n6. **\"Zen and the Art of Motorcycle Maintenance\"** — philosophy of quality that applies directly to software craftsmanship.\n7. **\"Gödel, Escher, Bach\"** by Hofstadter — technically non-fiction but reads like an intellectual adventure. About consciousness, recursion, and self-reference.\n\nI'd start with **\"Project Hail Mary\"** — you'll finish it in two days and immediately want to discuss it.", ts: [19, 30] },
    ],
    memories: [
      { name: 'Technical Reading List', content: 'Top technical books for senior engineers: "Designing Data-Intensive Applications" by Kleppmann (distributed systems), "A Philosophy of Software Design" by Ousterhout (complexity management), and "Staff Engineer" by Larson (staff+ career path).' },
      { name: 'Fiction for Engineers', content: 'Fiction that builds technical creativity: "Project Hail Mary" (engineering problem-solving), "Exhalation" by Ted Chiang (consciousness and technology), "Klara and the Sun" (AI perspective), "Gödel, Escher, Bach" (recursion and self-reference).' },
    ],
    entities: ['Machine Learning', 'Microservices'],
    summary: 'Curated reading list for senior software engineers: technical books (DDIA, Philosophy of Software Design), leadership (Manager\'s Path, Crucial Conversations), and fiction that builds creative thinking (Project Hail Mary, Exhalation, Three-Body Problem).',
  },
  {
    id: 'meal-prep-claude-web',
    title: 'Weekly Meal Prep for Busy Developers',
    app_name: 'Claude.ai-browser',
    created_at: daysAgo(0, 8, 0),
    updated_at: daysAgo(0, 9, 0),
    messages: [
      { role: 'user', content: "I spend way too much on takeout because I'm too tired to cook after work. Can you help me set up a simple meal prep system? I have about 2-3 hours on Sunday.", ts: [8, 0] },
      { role: 'assistant', content: "Here's a battle-tested meal prep system that takes ~2.5 hours on Sunday and feeds you for the whole work week:\n\n**The Framework: 3 Proteins + 3 Sides + Versatile Base**\n\nThis week's plan:\n\n**Proteins (cook all three):**\n1. Sheet pan chicken thighs (season half with lemon herb, half with teriyaki)\n2. Turkey meatballs (make 20, freeze half for next week)\n3. Black bean and sweet potato filling (vegetarian option)\n\n**Bases:**\n- Big batch of jasmine rice (rice cooker)\n- Roasted sweet potatoes (sheet pan alongside chicken)\n\n**Sides (prep raw, cook day-of if needed):**\n- Chopped stir-fry vegetables (bell peppers, broccoli, snap peas)\n- Mixed green salad kits in mason jars\n- Steamed broccoli with garlic\n\n**Mix-and-Match Meals:**\n- Monday: Lemon herb chicken + rice + roasted sweet potato\n- Tuesday: Turkey meatballs + rice + stir-fry veggies\n- Wednesday: Black bean sweet potato bowl + salad\n- Thursday: Teriyaki chicken + rice + steamed broccoli\n- Friday: Meatball sub with leftover meatballs\n\n**Sunday Timeline:**\n- 0:00 — Preheat oven, start rice cooker\n- 0:10 — Season and pan chicken + sweet potatoes on sheet pans\n- 0:15 — Mix and form meatballs\n- 0:20 — Everything in oven\n- 0:45 — While things bake: chop vegetables, make mason jar salads\n- 1:15 — Pull chicken and meatballs, let cool\n- 1:30 — Portion into containers\n- 2:00 — Clean up, done!\n\nTotal cost: ~$40-50 for 10 meals = $4-5/meal vs. $15-20 takeout.", ts: [8, 5] },
      { role: 'user', content: "This is great! What containers do you recommend and how long does everything stay fresh?", ts: [8, 25] },
      { role: 'assistant', content: "**Container Setup (one-time $30-40 investment):**\n\n**Best Option: Glass Meal Prep Containers**\n- Get a 10-pack of 2-compartment glass containers (brand: Prep Naturals or Bayco)\n- Glass doesn't stain, absorb odors, or warp\n- Microwave and dishwasher safe\n- The visual of seeing your meals lined up in the fridge is oddly motivating\n\n**Also Useful:**\n- Mason jars (32oz) for salads — dressing on bottom, greens on top, stays fresh 5 days\n- Small sauce containers for dressings/sauces\n- Freezer bags for the extra meatballs\n\n**Freshness Guide:**\n| Food | Fridge | Freezer |\n|------|--------|---------|\n| Cooked chicken | 4 days | 3 months |\n| Meatballs | 4 days | 3 months |\n| Cooked rice | 5 days | 6 months |\n| Roasted veggies | 4 days | Don't freeze |\n| Raw chopped veggies | 5 days | N/A |\n| Mason jar salads | 5 days | N/A |\n\n**Pro Tips:**\n1. Cook Monday-Wednesday portions for fridge, Thursday-Friday for freezer\n2. Let food cool completely before sealing containers (prevents condensation)\n3. Don't store rice and protein together — rice gets mushy absorbing chicken juices\n4. Label containers with day of the week using dry-erase markers on glass\n\nThe system pays for itself in the first week vs. takeout costs.", ts: [8, 35] },
    ],
    memories: [
      { name: 'Meal Prep System', content: 'Weekly meal prep framework: 3 proteins + versatile base + mix-and-match sides. Takes 2.5 hours Sunday, produces 10 meals at $4-5 each. Key: sheet pan cooking for efficiency, make extra meatballs to freeze for next week.' },
      { name: 'Food Storage Guidelines', content: 'Cooked chicken and meatballs stay fresh 4 days in fridge, 3 months frozen. Cooked rice lasts 5 days. Store rice and protein separately to prevent mushiness. Use glass containers and cool food completely before sealing.' },
    ],
    entities: [],
    summary: 'Set up a weekly meal prep system for busy workdays. Framework: 3 proteins + base + sides, cooked in 2.5 hours on Sunday for 10 meals at $4-5 each. Covered container recommendations, freshness guidelines, and cost savings vs. takeout.',
  },
  {
    id: 'career-growth-gemini',
    title: 'Career Growth: Senior to Staff Engineer',
    app_name: 'Gemini',
    created_at: daysAgo(0, 11, 0),
    updated_at: daysAgo(0, 12, 0),
    messages: [
      { role: 'user', content: "I've been a senior software engineer for 3 years and I want to grow into a staff engineering role. What does it actually take beyond just being a better coder?", ts: [11, 0] },
      { role: 'assistant', content: "Great question — the senior-to-staff transition is one of the biggest career inflection points, and it's NOT about writing more code. Here's what changes:\n\n**The Core Shift: From Solving Problems to Finding the Right Problems**\n\nAs a senior engineer, you solve hard problems. As a staff engineer, you identify WHICH problems are worth solving and influence the organization to solve them.\n\n**Four Pillars of Staff Engineering:**\n\n**1. Technical Vision & Strategy**\n- Write technical RFCs and architecture decision records (ADRs)\n- Create 6-12 month technical roadmaps for your domain\n- Anticipate technical debt before it becomes critical\n- Example: \"We need to migrate from REST to GraphQL because our mobile clients are over-fetching by 40%\"\n\n**2. Cross-Team Impact**\n- Your work should affect multiple teams, not just your own\n- Build platforms, libraries, and standards others adopt\n- Mentor senior engineers (not just juniors)\n- Example: Design a shared authentication library used by 5 teams\n\n**3. Technical Leadership Without Authority**\n- Influence through persuasion, not title\n- Navigate ambiguity — staff-level problems don't have clear solutions\n- Make decisions and own the outcomes\n- Build consensus on controversial technical choices\n\n**4. Organizational Awareness**\n- Understand business priorities and translate them into technical strategy\n- Know when to build vs. buy vs. partner\n- Communicate technical concepts to non-technical stakeholders\n- Align engineering effort with company goals", ts: [11, 5] },
      { role: 'user', content: "This is really helpful. How do I actually demonstrate these skills while I'm still in a senior role? I don't want to overstep.", ts: [11, 20] },
      { role: 'assistant', content: "You don't need permission to operate at staff level — in fact, most companies want you to demonstrate the skills BEFORE the promotion. Here's how to do it authentically:\n\n**Immediate Actions (Start This Week):**\n\n1. **Write an RFC for something you believe should change**\n   - Pick a real technical problem that spans your team's boundaries\n   - Document the problem, evaluate 3 options, recommend one\n   - Share it broadly and invite feedback\n   - This single artifact demonstrates vision, communication, and leadership\n\n2. **Start a \"Tech Radar\" for your org**\n   - Document which technologies you're adopting, holding, or retiring\n   - Get buy-in from other senior engineers\n   - Present it at an engineering all-hands\n\n3. **Volunteer for cross-team projects**\n   - Not the glamorous new features — the unglamorous platform work\n   - Migration projects, CI/CD improvements, observability\n   - These naturally require cross-team coordination\n\n**Medium-Term (Next 3-6 Months):**\n\n4. **Mentor a senior engineer**\n   - Not code review — strategic mentorship\n   - Help them think about system design, trade-offs, career\n   - This signals that you're operating at a higher level\n\n5. **Build your \"staff engineer portfolio\"**\n   - Document your biggest technical decisions and their impact\n   - Track metrics: performance improved by X%, incidents reduced by Y%\n   - This becomes your promotion case\n\n6. **Have the explicit conversation with your manager**\n   - \"I want to grow toward staff. What gaps do you see?\"\n   - Get specific, actionable feedback\n   - Create a plan together with quarterly checkpoints\n\n**The Key Mindset:**\nDon't ask for permission to lead. Just start doing it. If you're consistently operating at staff level, the title follows.", ts: [11, 30] },
      { role: 'user', content: "One thing I struggle with is the writing part — RFCs, ADRs, documentation. Any tips for a developer who's more comfortable with code than prose?", ts: [11, 45] },
      { role: 'assistant', content: "This is extremely common and fixable. Writing is a learnable skill, and the bar for technical writing isn't \"beautiful prose\" — it's clarity.\n\n**RFC Template (Use This Every Time):**\n```markdown\n# RFC: [Short descriptive title]\n\n## Problem Statement\nOne paragraph. What's broken or missing? Include data.\n\n## Proposed Solution\nThe approach you recommend. Be specific enough to implement.\n\n## Alternatives Considered\n| Option | Pros | Cons |\n|--------|------|------|\n| Option A | ... | ... |\n| Option B | ... | ... |\n\n## Why This Approach\n2-3 paragraphs explaining your reasoning.\n\n## Risks & Mitigations\nWhat could go wrong? How do we handle it?\n\n## Timeline & Milestones\nPhased rollout plan.\n```\n\n**Writing Tips for Engineers:**\n\n1. **Write like you talk** — if you can explain something in a Slack message, you can write an RFC. Just clean it up slightly.\n\n2. **Lead with the conclusion** — engineers are busy. Put the recommendation in the first paragraph, then justify it.\n\n3. **Use data, not opinions** — \"This approach is 3x faster (see benchmark)\" > \"I think this approach is better\"\n\n4. **Use diagrams** — a Mermaid diagram or architecture sketch replaces 500 words.\n\n5. **Write first, edit later** — perfection kills productivity. Get the ideas down, then refine.\n\n6. **Read good examples** — Google's design docs, Uber's engineering blog, and Gergely Orosz's newsletter are excellent models.\n\n**Daily Practice:**\n- Write a 2-3 sentence summary of every technical decision you make in Slack\n- After each PR, write a brief \"why\" comment on your own PR description\n- These small reps build the muscle without feeling like \"writing\"\n\nIn 3 months of consistent practice, writing will feel natural.", ts: [12, 0] },
    ],
    memories: [
      { name: 'Staff Engineer Pillars', content: 'Four pillars of staff engineering: technical vision and strategy (RFCs, roadmaps), cross-team impact (platforms, shared libraries), technical leadership without authority (influence through persuasion), and organizational awareness (business-technical alignment).' },
      { name: 'Staff Promotion Strategy', content: 'Demonstrate staff-level skills before promotion: write RFCs, volunteer for cross-team platform work, mentor senior engineers strategically, build a portfolio of technical decisions with measured impact, and have explicit career conversation with manager.' },
      { name: 'Technical Writing for Engineers', content: 'RFC template: Problem Statement, Proposed Solution, Alternatives table, Reasoning, Risks, Timeline. Key tips: lead with conclusion, use data over opinions, add diagrams, write like you talk then edit.' },
    ],
    entities: ['TypeScript', 'React', 'Node.js', 'Microservices'],
    summary: 'Career development discussion about transitioning from senior to staff engineer. Covered four pillars of staff engineering, practical actions to demonstrate staff-level skills, and technical writing tips including an RFC template.',
  },
];

// ============================================================
// ENTITIES
// ============================================================

const ENTITIES = [
  { name: 'React', type: 'Technology', summary: 'JavaScript library for building user interfaces. Used for the real-time analytics dashboard project with Zustand state management and D3.js visualizations. Discussed component architecture, React.memo optimization, and integration patterns.' },
  { name: 'Node.js', type: 'Technology', summary: 'Server-side JavaScript runtime. Discussed in context of production memory leak debugging — identified event listener accumulation on Redis pub/sub as the root cause. Covered heap snapshot analysis and common leak patterns.' },
  { name: 'TypeScript', type: 'Technology', summary: 'Typed superset of JavaScript used across multiple projects. Mentioned in dashboard development with Zustand store patterns and general engineering best practices.' },
  { name: 'PostgreSQL', type: 'Technology', summary: 'Relational database used for e-commerce product search. Optimized a 50M row query from 12 seconds to 45ms using composite and covering indexes. Discussed index maintenance, autovacuum tuning, and pg_stat_statements monitoring.' },
  { name: 'Kafka', type: 'Technology', summary: 'Distributed event streaming platform chosen for e-commerce microservices architecture. Used as the backbone for event-driven communication between Order, Inventory, Payment, and Shipping services. Handles compensating transactions via Saga pattern.' },
  { name: 'Redis', type: 'Technology', summary: 'In-memory data store used in two contexts: as a read-side cache in the CQRS e-commerce architecture, and as a pub/sub system where an event listener leak caused a Node.js production memory leak.' },
  { name: 'Docker', type: 'Technology', summary: 'Container platform mentioned in the context of microservices deployment and the e-commerce platform architecture discussion.' },
  { name: 'WebSocket', type: 'Technology', summary: 'Protocol used for real-time data streaming in the React analytics dashboard. Integrated with Zustand store for efficient state management with per-widget re-rendering.' },
  { name: 'D3.js', type: 'Technology', summary: 'Data visualization library integrated with React for the dashboard project. Best practice: let React own the DOM, use D3 only for calculations (scales, layouts, path generators).' },
  { name: 'Zustand', type: 'Technology', summary: 'Lightweight React state management library chosen over Redux for the real-time dashboard. Key advantage: only components subscribing to specific metrics re-render, critical for dashboards with 20+ widgets updating every second.' },
  { name: 'Kubernetes', type: 'Technology', summary: 'Container orchestration platform referenced in context of deploying and scaling the event-driven microservices architecture.' },
  { name: 'Sarah Chen', type: 'Person', summary: 'Team member who recommended Zustand for state management in the real-time dashboard project. Works on the frontend engineering team.' },
  { name: 'Mike Rodriguez', type: 'Person', summary: 'Team lead who requested the drag-and-drop layout system for the analytics dashboard. Stakeholder in the dashboard project.' },
  { name: 'Dr. Priya Sharma', type: 'Person', summary: 'Stanford researcher who gave a talk about AI in healthcare diagnostics. Referenced as authority on diagnostic imaging being the most mature AI healthcare application.' },
  { name: 'Event-Driven Architecture', type: 'Concept', summary: 'Architectural pattern chosen for the e-commerce platform redesign. Services communicate through domain events via Kafka topics. Combined with Saga pattern for distributed transaction handling and CQRS for read/write separation.' },
  { name: 'CQRS Pattern', type: 'Concept', summary: 'Command Query Responsibility Segregation pattern applied to e-commerce: PostgreSQL for writes (5% traffic), Elasticsearch + Redis for reads (95% traffic). Kafka bridges the sync with 100-500ms eventual consistency.' },
  { name: 'Microservices', type: 'Concept', summary: 'Architectural style adopted for the e-commerce platform, decomposing the monolith into Order, Inventory, Payment, Shipping, and Notification services. Requires distributed tracing, Saga patterns, and careful service boundary design.' },
  { name: 'Quantum Computing', type: 'Concept', summary: 'Emerging computing paradigm using qubits, superposition, and entanglement. Key applications: cryptography (Shor\'s algorithm), drug discovery, optimization. Practical experimentation available via IBM Qiskit with free 127-qubit hardware access.' },
  { name: 'Machine Learning', type: 'Concept', summary: 'Discussed in healthcare AI context (diagnostic imaging, drug discovery, predictive analytics) and as a potential quantum computing application (quantum ML subroutines). Also referenced in book recommendations for engineers.' },
  { name: 'Healthcare AI', type: 'Concept', summary: 'AI applications in healthcare covering six areas: medical imaging diagnostics, drug discovery, personalized treatment, administrative automation, predictive analytics, and mental health. Key ethical concerns include training data bias and the black box problem.' },
  { name: 'Tokyo', type: 'Place', summary: 'First stop on the 14-day Japan trip (5 days). Key activities: Shibuya Crossing, Shinjuku Gyoen for cherry blossoms, Akihabara, Tsukiji Market. Food highlights: ramen shops with ticket machines, yakitori under Yurakucho tracks.' },
  { name: 'Kyoto', type: 'Place', summary: 'Second stop on the Japan trip (5 days). Highlights: Fushimi Inari, Arashiyama Bamboo Grove, Philosopher\'s Path for cherry blossoms, Gion geisha district. Food: kaiseki dinner, matcha in Uji, yudofu near Nanzen-ji, Nishiki Market.' },
];

// Map entity names to session IDs
const ENTITY_SESSION_MAP = {
  'React': ['react-dashboard-claude-desktop', 'career-growth-gemini'],
  'Node.js': ['nodejs-memory-leaks-claude-desktop', 'career-growth-gemini'],
  'TypeScript': ['react-dashboard-claude-desktop', 'postgresql-optimization-claude-desktop', 'career-growth-gemini'],
  'PostgreSQL': ['postgresql-optimization-claude-desktop', 'event-driven-ecommerce-claude-web'],
  'Kafka': ['event-driven-ecommerce-claude-web'],
  'Redis': ['event-driven-ecommerce-claude-web', 'nodejs-memory-leaks-claude-desktop'],
  'Docker': ['event-driven-ecommerce-claude-web'],
  'WebSocket': ['react-dashboard-claude-desktop'],
  'D3.js': ['react-dashboard-claude-desktop'],
  'Zustand': ['react-dashboard-claude-desktop'],
  'Kubernetes': ['event-driven-ecommerce-claude-web'],
  'Sarah Chen': ['react-dashboard-claude-desktop'],
  'Mike Rodriguez': ['react-dashboard-claude-desktop'],
  'Dr. Priya Sharma': ['ai-healthcare-chatgpt'],
  'Event-Driven Architecture': ['event-driven-ecommerce-claude-web'],
  'CQRS Pattern': ['event-driven-ecommerce-claude-web'],
  'Microservices': ['event-driven-ecommerce-claude-web', 'career-growth-gemini', 'book-recommendations-chatgpt'],
  'Quantum Computing': ['quantum-computing-chatgpt'],
  'Machine Learning': ['ai-healthcare-chatgpt', 'quantum-computing-chatgpt'],
  'Healthcare AI': ['ai-healthcare-chatgpt'],
  'Tokyo': ['japan-trip-gemini'],
  'Kyoto': ['japan-trip-gemini'],
};

// Entity facts
const ENTITY_FACTS = {
  'React': [
    { fact: 'Used with Zustand for state management in the real-time dashboard, replacing Redux for better per-widget re-rendering performance', session: 'react-dashboard-claude-desktop' },
    { fact: 'D3.js integration pattern: React owns DOM, D3 handles calculations (scales, layouts, path generators)', session: 'react-dashboard-claude-desktop' },
    { fact: 'react-grid-layout used for drag-and-drop dashboard widget arrangement', session: 'react-dashboard-claude-desktop' },
    { fact: 'React.memo recommended for individual dashboard widgets receiving frequently changing props', session: 'react-dashboard-claude-desktop' },
  ],
  'Node.js': [
    { fact: 'Production memory leak caused by event listeners accumulating on Redis pub/sub inside request handlers', session: 'nodejs-memory-leaks-claude-desktop' },
    { fact: 'Debug memory leaks using v8.writeHeapSnapshot() and comparing snapshots in Chrome DevTools', session: 'nodejs-memory-leaks-claude-desktop' },
    { fact: 'Event listener leaks account for approximately 60% of Node.js memory leak cases', session: 'nodejs-memory-leaks-claude-desktop' },
    { fact: 'Use --max-old-space-size=512 in production to make memory leaks crash earlier during development', session: 'nodejs-memory-leaks-claude-desktop' },
  ],
  'TypeScript': [
    { fact: 'Used for Zustand store type definitions in the dashboard project', session: 'react-dashboard-claude-desktop' },
    { fact: 'Mentioned as a key skill for staff engineering career growth', session: 'career-growth-gemini' },
  ],
  'PostgreSQL': [
    { fact: 'Optimized 50M row product search query from 12 seconds to 45ms using covering index', session: 'postgresql-optimization-claude-desktop' },
    { fact: 'Composite index strategy: exact-match columns first, range columns second, INCLUDE for covering index-only scans', session: 'postgresql-optimization-claude-desktop' },
    { fact: 'Used as the write-side transactional database in the CQRS e-commerce architecture', session: 'event-driven-ecommerce-claude-web' },
    { fact: 'pg_stat_statements extension is the single most valuable monitoring tool for finding slow queries', session: 'postgresql-optimization-claude-desktop' },
    { fact: 'Tune autovacuum_vacuum_scale_factor to 0.01 for large tables (default 0.2 is too infrequent)', session: 'postgresql-optimization-claude-desktop' },
  ],
  'Kafka': [
    { fact: 'Used as the event backbone for e-commerce microservices with dedicated topics per domain event', session: 'event-driven-ecommerce-claude-web' },
    { fact: 'Bridges CQRS write-to-read synchronization with 100-500ms eventual consistency', session: 'event-driven-ecommerce-claude-web' },
    { fact: 'Consumer group lag monitoring critical for detecting slow consumers in event-driven architecture', session: 'event-driven-ecommerce-claude-web' },
  ],
  'Redis': [
    { fact: 'Serves as read-side cache in CQRS pattern for frequently accessed product details and user sessions', session: 'event-driven-ecommerce-claude-web' },
    { fact: 'Pub/sub client was source of memory leak — event listeners were added per request without cleanup', session: 'nodejs-memory-leaks-claude-desktop' },
  ],
  'Sarah Chen': [
    { fact: 'Recommended Zustand over Redux for the real-time dashboard state management', session: 'react-dashboard-claude-desktop' },
    { fact: 'Works on the frontend engineering team', session: 'react-dashboard-claude-desktop' },
  ],
  'Mike Rodriguez': [
    { fact: 'Requested drag-and-drop layout system for the analytics dashboard', session: 'react-dashboard-claude-desktop' },
    { fact: 'Team lead and stakeholder for the dashboard project', session: 'react-dashboard-claude-desktop' },
  ],
  'Dr. Priya Sharma': [
    { fact: 'Stanford researcher specializing in AI applications in healthcare', session: 'ai-healthcare-chatgpt' },
    { fact: 'Stated that diagnostic imaging is the most mature AI application in healthcare', session: 'ai-healthcare-chatgpt' },
  ],
  'Event-Driven Architecture': [
    { fact: 'Five core services: Order, Inventory, Payment, Shipping, Notification — each emitting and consuming domain events', session: 'event-driven-ecommerce-claude-web' },
    { fact: 'Uses choreography-based Saga pattern with compensating transactions for failure handling', session: 'event-driven-ecommerce-claude-web' },
    { fact: 'Every event handler must be idempotent to handle duplicate processing safely', session: 'event-driven-ecommerce-claude-web' },
  ],
  'CQRS Pattern': [
    { fact: 'Write side uses PostgreSQL for transactional data; read side uses Elasticsearch for search and Redis for caching', session: 'event-driven-ecommerce-claude-web' },
    { fact: 'Read-heavy e-commerce traffic (95%) served from optimized read stores; writes (5%) hit transactional DB', session: 'event-driven-ecommerce-claude-web' },
  ],
  'Microservices': [
    { fact: 'E-commerce monolith decomposed into Order, Inventory, Payment, Shipping, and Notification services', session: 'event-driven-ecommerce-claude-web' },
    { fact: 'Requires three-pillar observability: distributed tracing, metrics (Prometheus+Grafana), and centralized logging (ELK)', session: 'event-driven-ecommerce-claude-web' },
    { fact: 'Correlation IDs passed through Kafka headers enable end-to-end request tracing across services', session: 'event-driven-ecommerce-claude-web' },
  ],
  'Quantum Computing': [
    { fact: '50 qubits can process 2^50 states simultaneously, equivalent to 1 petabyte of classical RAM', session: 'quantum-computing-chatgpt' },
    { fact: 'Key applications: cryptography (Shor\'s algorithm, 10-15 years away), molecular simulation, optimization, quantum ML', session: 'quantum-computing-chatgpt' },
    { fact: 'IBM provides free access to 127-qubit real quantum hardware for experimentation', session: 'quantum-computing-chatgpt' },
    { fact: 'Cannot make everyday applications faster or solve NP-hard problems in polynomial time', session: 'quantum-computing-chatgpt' },
  ],
  'Machine Learning': [
    { fact: 'AI diagnostic imaging is the most FDA-approved AI application in healthcare', session: 'ai-healthcare-chatgpt' },
    { fact: 'Google Health AI reduced mammography false negatives by 9.4% and false positives by 5.7%', session: 'ai-healthcare-chatgpt' },
    { fact: 'Quantum ML is still very theoretical but IBM and Google have published promising results on quantum kernels', session: 'quantum-computing-chatgpt' },
  ],
  'Healthcare AI': [
    { fact: 'Six application areas: imaging diagnostics, drug discovery, personalized treatment, admin automation, predictive analytics, mental health', session: 'ai-healthcare-chatgpt' },
    { fact: 'Key ethical concern: AI models trained on one demographic can perform poorly on others (bias in dermatology AI)', session: 'ai-healthcare-chatgpt' },
    { fact: 'IDx-DR was the first FDA-authorized autonomous AI diagnostic system, approved in 2018', session: 'ai-healthcare-chatgpt' },
  ],
  'Tokyo': [
    { fact: 'First stop on 14-day Japan trip: 5 days covering Shibuya, Asakusa, Shinjuku, Akihabara, and day trip to Kamakura', session: 'japan-trip-gemini' },
    { fact: 'Cherry blossom viewing at Shinjuku Gyoen park in April', session: 'japan-trip-gemini' },
    { fact: 'Must-try food: yakitori under Yurakucho train tracks, stand-up sushi at Tsukiji, depachika at Isetan Shinjuku', session: 'japan-trip-gemini' },
  ],
  'Kyoto': [
    { fact: 'Second stop: 5 days covering Fushimi Inari, Arashiyama, golden and silver pavilions, Philosopher\'s Path, and Gion', session: 'japan-trip-gemini' },
    { fact: 'Philosopher\'s Path is the best cherry blossom viewing spot in Kyoto', session: 'japan-trip-gemini' },
    { fact: 'Must-try: kaiseki multi-course dinner at a ryokan, matcha in Uji birthplace of green tea', session: 'japan-trip-gemini' },
  ],
  'Docker': [
    { fact: 'Used for containerizing microservices in the e-commerce platform architecture', session: 'event-driven-ecommerce-claude-web' },
  ],
  'WebSocket': [
    { fact: 'Used for real-time data streaming in the React dashboard with Zustand integration', session: 'react-dashboard-claude-desktop' },
    { fact: 'WebSocket provider at top of component tree distributes events via React Context', session: 'react-dashboard-claude-desktop' },
  ],
  'D3.js': [
    { fact: 'Integrated with React for dashboard visualizations using the calculation-only pattern', session: 'react-dashboard-claude-desktop' },
    { fact: 'Used for scales (scaleTime, scaleLinear), layouts, and path generators while React handles DOM rendering', session: 'react-dashboard-claude-desktop' },
  ],
  'Zustand': [
    { fact: 'Chosen over Redux for real-time dashboard due to selective re-rendering — only subscribed components update', session: 'react-dashboard-claude-desktop' },
    { fact: 'Sarah Chen recommended it based on team experience', session: 'react-dashboard-claude-desktop' },
    { fact: 'WebSocket messages dispatched through Zustand store for centralized real-time state management', session: 'react-dashboard-claude-desktop' },
  ],
  'Kubernetes': [
    { fact: 'Referenced for deploying and scaling the event-driven microservices architecture', session: 'event-driven-ecommerce-claude-web' },
  ],
};

// ============================================================
// MASTER MEMORY
// ============================================================

const MASTER_MEMORY = `# Personal Knowledge Summary

## Technical Expertise & Decisions

### Frontend Architecture
- Building a real-time SaaS analytics dashboard using React with WebSocket for live data streaming
- Chose Zustand over Redux for state management — key advantage is per-widget re-rendering in dashboards with 20+ widgets updating every second
- D3.js integration pattern: React owns the DOM, D3 handles only calculations (scales, layouts, path generators)
- Using react-grid-layout for drag-and-drop dashboard customization with preset layouts

### Backend & Infrastructure
- Designed event-driven e-commerce microservices architecture with Kafka as the event backbone
- Five core services: Order, Inventory, Payment, Shipping, Notification — communicating through domain events
- Implemented CQRS pattern: PostgreSQL for writes (5% traffic), Elasticsearch + Redis for reads (95% traffic)
- Choreography-based Saga pattern for distributed transaction handling with compensating transactions
- Optimized PostgreSQL queries on 50M row tables from 12 seconds to 45ms using covering indexes

### Debugging & Operations
- Diagnosed Node.js production memory leak caused by event listeners accumulating on Redis pub/sub client
- Event listener leaks account for ~60% of Node.js memory leaks
- Three-pillar observability for microservices: distributed tracing with correlation IDs, Prometheus+Grafana metrics, ELK stack logging
- PostgreSQL maintenance: pg_stat_statements for slow query monitoring, autovacuum tuning, regular REINDEX CONCURRENTLY

## Research & Learning

### AI & Healthcare
- Researched six major areas where AI transforms healthcare: diagnostic imaging, drug discovery, personalized treatment, admin automation, predictive analytics, mental health
- Google Health AI reduced mammography false negatives by 9.4% — diagnostic imaging is the most FDA-approved AI application
- Key ethical concerns: demographic bias in training data, black box problem, liability frameworks, access inequality

### Quantum Computing
- Quantum computing uses superposition, entanglement, and interference — 50 qubits process 2^50 states simultaneously
- Key applications: cryptography breaking (10-15 years), molecular simulation, optimization
- Practical experimentation available via IBM Qiskit with free 127-qubit hardware

### Reading & Growth
- Top technical books: "Designing Data-Intensive Applications" (Kleppmann), "A Philosophy of Software Design" (Ousterhout)
- Fiction for engineers: "Project Hail Mary" (engineering problem-solving), "Exhalation" (consciousness and technology)

## Career Development
- Four pillars of staff engineering: technical vision, cross-team impact, leadership without authority, organizational awareness
- Key strategy: demonstrate staff-level skills before promotion — write RFCs, volunteer for cross-team work, mentor senior engineers
- RFC template: Problem Statement → Proposed Solution → Alternatives → Reasoning → Risks → Timeline
- Technical writing tips: lead with conclusion, use data over opinions, add diagrams

## Personal
- Planning 14-day Japan trip for cherry blossom season: Tokyo (5 days) → Kyoto (5 days) → Osaka (3 days)
- Budget: $120-180/day mid-range, 14-day JR Pass for ¥50,000
- Must-try food: Tokyo yakitori under Yurakucho tracks, Kyoto kaiseki, Osaka takoyaki in Dotonbori
- Weekly meal prep system: 3 proteins + base + sides in 2.5 hours Sunday, $4-5/meal for the week

## Key People
- **Sarah Chen**: Frontend engineer who recommended Zustand for the dashboard project
- **Mike Rodriguez**: Team lead requesting dashboard layout customization features
- **Dr. Priya Sharma**: Stanford researcher, authority on AI in healthcare diagnostics`;

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('\n=== My Memories Demo Database Seeder ===\n');

  // 1. Backup existing DB
  if (fs.existsSync(DB_PATH)) {
    if (fs.existsSync(BACKUP_PATH)) {
      console.log('Backup already exists. Remove it first or run --restore.');
      console.log(`  Backup: ${BACKUP_PATH}`);
      process.exit(1);
    }
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    for (const ext of ['-wal', '-shm']) {
      if (fs.existsSync(DB_PATH + ext)) fs.copyFileSync(DB_PATH + ext, BACKUP_PATH + ext);
    }
    fs.unlinkSync(DB_PATH);
    for (const ext of ['-wal', '-shm']) {
      if (fs.existsSync(DB_PATH + ext)) fs.unlinkSync(DB_PATH + ext);
    }
    console.log(`Backed up existing DB to: ${BACKUP_PATH}`);
  } else {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log('No existing DB found. Creating fresh.');
  }

  // 2. Create new DB with schema
  console.log('Creating database schema...');
  sql(SCHEMA_SQL);
  sql("PRAGMA journal_mode = WAL;");
  for (const trigger of TRIGGERS_SQL) {
    sql(trigger);
  }

  // 3. Seed conversations and messages
  console.log('Seeding conversations and messages...');

  let totalMessages = 0;
  let msgAutoId = 1; // track message IDs manually
  const memoryTexts = [];
  const memoryAutoIds = [];
  let memAutoId = 1;

  let allSql = '';

  for (const conv of CONVERSATIONS) {
    allSql += `INSERT INTO conversations (id, title, app_name, created_at, updated_at) VALUES (${esc(conv.id)}, ${esc(conv.title)}, ${esc(conv.app_name)}, ${esc(conv.created_at)}, ${esc(conv.updated_at)});\n`;

    const assistantMsgIds = [];

    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i];
      const ts = timeStr(msg.ts[0], msg.ts[1]);
      const msgDate = new Date(conv.created_at.replace(' ', 'T') + 'Z');
      msgDate.setHours(msg.ts[0], msg.ts[1], 0, 0);
      const createdAt = msgDate.toISOString().replace('T', ' ').replace('Z', '');

      allSql += `INSERT INTO messages (conversation_id, role, content, timestamp, created_at) VALUES (${esc(conv.id)}, ${esc(msg.role)}, ${esc(msg.content)}, ${esc(ts)}, ${esc(createdAt)});\n`;

      if (msg.role === 'assistant') {
        assistantMsgIds.push({ id: msgAutoId, content: msg.content });
      }
      msgAutoId++;
      totalMessages++;
    }

    // Seed memories for this conversation
    if (conv.memories && conv.memories.length > 0) {
      for (let i = 0; i < conv.memories.length; i++) {
        const mem = conv.memories[i];
        const linkedMsg = assistantMsgIds[Math.min(i, assistantMsgIds.length - 1)];
        allSql += `INSERT INTO memories (content, raw_text, source_app, session_id, message_id, name, created_at) VALUES (${esc(mem.content)}, ${esc(linkedMsg.content)}, ${esc(conv.app_name)}, ${esc(conv.id)}, ${linkedMsg.id}, ${esc(mem.name)}, ${esc(conv.created_at)});\n`;
        memoryTexts.push(mem.content);
        memoryAutoIds.push(memAutoId);
        memAutoId++;
      }
    }
  }
  sql(allSql);
  const totalMemories = memoryTexts.length;
  console.log(`  ${CONVERSATIONS.length} conversations, ${totalMessages} messages, ${totalMemories} memories`);

  // 4. Seed entities
  console.log('Seeding entities...');
  const entityIdMap = {};
  let entityAutoId = 1;
  let entitySql = '';

  for (const entity of ENTITIES) {
    const sessions = ENTITY_SESSION_MAP[entity.name] || [];
    const firstConv = CONVERSATIONS.find(c => sessions.includes(c.id));
    const createdAt = firstConv ? firstConv.created_at : daysAgo(0);

    entitySql += `INSERT INTO entities (name, type, summary, created_at, updated_at) VALUES (${esc(entity.name)}, ${esc(entity.type)}, ${esc(entity.summary)}, ${esc(createdAt)}, ${esc(daysAgo(0))});\n`;
    entityIdMap[entity.name] = entityAutoId;
    entityAutoId++;
  }
  sql(entitySql);
  console.log(`  ${ENTITIES.length} entities`);

  // 5. Seed entity facts
  console.log('Seeding entity facts...');
  let factSql = '';
  let totalFacts = 0;

  for (const [entityName, facts] of Object.entries(ENTITY_FACTS)) {
    const entityId = entityIdMap[entityName];
    if (!entityId) continue;
    for (const f of facts) {
      const conv = CONVERSATIONS.find(c => c.id === f.session);
      factSql += `INSERT OR IGNORE INTO entity_facts (entity_id, fact, source_session_id, created_at) VALUES (${entityId}, ${esc(f.fact)}, ${esc(f.session)}, ${esc(conv ? conv.created_at : daysAgo(0))});\n`;
      totalFacts++;
    }
  }
  sql(factSql);
  console.log(`  ${totalFacts} entity facts`);

  // 6. Seed entity_sessions
  console.log('Seeding entity-session links...');
  let linkSql = '';
  let totalLinks = 0;

  for (const [entityName, sessionIds] of Object.entries(ENTITY_SESSION_MAP)) {
    const entityId = entityIdMap[entityName];
    if (!entityId) continue;
    for (const sid of sessionIds) {
      linkSql += `INSERT OR IGNORE INTO entity_sessions (entity_id, session_id) VALUES (${entityId}, ${esc(sid)});\n`;
      totalLinks++;
    }
  }
  sql(linkSql);
  console.log(`  ${totalLinks} entity-session links`);

  // 7. Build entity edges (co-occurrence)
  console.log('Building entity edges...');
  const sessionEntityMap = {};
  for (const [entityName, sessionIds] of Object.entries(ENTITY_SESSION_MAP)) {
    for (const sid of sessionIds) {
      if (!sessionEntityMap[sid]) sessionEntityMap[sid] = [];
      sessionEntityMap[sid].push(entityIdMap[entityName]);
    }
  }

  let edgeSql = '';
  let totalEdges = 0;
  for (const [sessionId, entityIds] of Object.entries(sessionEntityMap)) {
    const ids = entityIds.filter(Boolean);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [src, tgt] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
        edgeSql += `INSERT INTO entity_edges (source_entity_id, target_entity_id, type, weight, evidence_count, last_session_id, updated_at) VALUES (${src}, ${tgt}, 'cooccurrence', 1, 1, ${esc(sessionId)}, CURRENT_TIMESTAMP) ON CONFLICT(source_entity_id, target_entity_id, type) DO UPDATE SET weight = entity_edges.weight + 1, evidence_count = entity_edges.evidence_count + 1, last_session_id = excluded.last_session_id, updated_at = excluded.updated_at;\n`;
        totalEdges++;
      }
    }
  }
  sql(edgeSql);
  console.log(`  ${totalEdges} entity edges`);

  // 8. Seed chat summaries
  console.log('Seeding chat summaries...');
  let sumSql = '';
  for (const conv of CONVERSATIONS) {
    if (conv.summary) {
      sumSql += `INSERT INTO chat_summaries (session_id, summary, created_at, updated_at) VALUES (${esc(conv.id)}, ${esc(conv.summary)}, ${esc(conv.created_at)}, ${esc(conv.updated_at)});\n`;
    }
  }
  sql(sumSql);
  console.log(`  ${CONVERSATIONS.length} summaries`);

  // 9. Seed master memory, user profile, settings
  console.log('Seeding master memory, profile, settings...');
  const profile = JSON.stringify({
    role: 'Senior Software Engineer',
    companySize: '50-200',
    aiUsageFrequency: 'Daily',
    primaryTools: ['Claude', 'ChatGPT', 'Gemini'],
    painPoints: ['Forgetting past conversations', 'Re-asking the same questions', 'Losing useful code snippets'],
    primaryUseCase: 'Coding and technical research',
    privacyConcern: 'Very concerned',
    expectedBenefit: 'A searchable memory of all my AI conversations',
    referralSource: 'Twitter/X',
    completedAt: daysAgo(14),
  });

  sql(`
    INSERT INTO master_memory (id, content, updated_at) VALUES (1, ${esc(MASTER_MEMORY)}, CURRENT_TIMESTAMP);
    INSERT INTO user_profile (id, data, created_at, updated_at) VALUES (1, ${esc(profile)}, ${esc(daysAgo(14))}, CURRENT_TIMESTAMP);
    INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('memoryStrictness', '"balanced"', CURRENT_TIMESTAMP);
    INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('entityStrictness', '"balanced"', CURRENT_TIMESTAMP);
  `);

  // 10. Rebuild FTS indexes
  console.log('Rebuilding FTS indexes...');
  try {
    sql(`
      INSERT INTO memory_fts(memory_fts) VALUES('rebuild');
      INSERT INTO message_fts(message_fts) VALUES('rebuild');
      INSERT INTO summary_fts(summary_fts) VALUES('rebuild');
      INSERT INTO entity_fts(entity_fts) VALUES('rebuild');
      INSERT INTO entity_fact_fts(entity_fact_fts) VALUES('rebuild');
    `);
  } catch (e) {
    console.log('  FTS rebuild warning:', e.message);
  }

  // 11. Generate real embeddings
  console.log('\nGenerating real embeddings (this may take a moment on first run)...');
  console.log('  Loading Xenova/all-MiniLM-L6-v2 model...');

  const { pipeline: pipelineFn, env } = await import('@xenova/transformers');
  env.allowRemoteModels = true;

  const extractor = await pipelineFn('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log(`  Model loaded. Generating embeddings for ${memoryTexts.length} memories...`);

  for (let i = 0; i < memoryTexts.length; i++) {
    const output = await extractor(memoryTexts[i], { pooling: 'mean', normalize: true });
    const embedding = JSON.stringify(Array.from(output.data));
    sql(`UPDATE memories SET embedding = ${esc(embedding)} WHERE id = ${memoryAutoIds[i]};`);
    process.stdout.write(`\r  Embedded ${i + 1}/${memoryTexts.length}`);
  }
  console.log('\n  All embeddings generated.');

  // 12. Final stats
  const stats = {
    conversations: CONVERSATIONS.length,
    messages: totalMessages,
    memories: totalMemories,
    entities: ENTITIES.length,
    facts: totalFacts,
    edges: totalEdges,
    summaries: CONVERSATIONS.length,
  };

  console.log('\n=== Demo Database Ready ===');
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nDatabase: ${DB_PATH}`);
  console.log(`Backup:   ${BACKUP_PATH}`);
  console.log('\nTo restore your original DB:');
  console.log('  node scripts/seed-demo.mjs --restore\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
