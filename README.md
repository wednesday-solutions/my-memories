# My Memories

Capture your life without giving it away.

My Memories is a local‑first desktop app that turns the stuff you already have — chats, notes, screenshots, PDFs, and more — into a searchable, connected memory graph. Everything runs on your machine, powered by on‑device AI, so your private moments stay private.

## Why it exists

Our lives are scattered across apps and files. Searching is slow, context is lost, and “that one message” can take forever to find. My Memories solves that by extracting meaning, connecting entities, and surfacing the right memory when you need it — instantly, and offline.

## What you get

- **Local‑only intelligence**: AI extraction, embeddings, and retrieval all happen on-device.
- **A living memory map**: See people, places, and topics connected through an interactive entity graph.
- **Fast recall**: A memory feed and semantic search turn “I remember…” into actual results.
- **Multimodal ingestion**: Text and vision pipelines for diverse sources.
- **Beautiful desktop experience**: Smooth, native-feeling UI built with Electron + React.

## How it feels

- Ask a question and get a grounded answer with relevant memories.
- Jump from a chat to related entities and other moments you forgot you saved.
- Rebuild context in seconds — without uploading a single byte.

## Tech stack

- Electron + Vite
- React + TypeScript
- Node.js main process with native helpers
- Local LLM binaries and GGUF models

## Repo map

- src/main: ingestion, database, embeddings, LLM, vision, watcher
- src/renderer: UI and components
- src/preload: Electron bridge
- resources/bin: local inference binaries
- resources/models: GGUF models used by the app

## Quick start

Prerequisites:

- Node.js 18+ (recommended)
- npm

Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm run dev
```

Build desktop packages:

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

## Models and binaries

Local inference binaries live in resources/bin and GGUF models live in resources/models. If you swap models, update the main‑process configuration accordingly.

## Scripts

Helper scripts for model downloads, vision tests, and utilities live in scripts/.

## Security and privacy

My Memories is built for on‑device use. Data stays on your computer. Review src/main for storage and ingestion details if you handle sensitive material.

## License

Add a license file if you plan to distribute this project publicly.
