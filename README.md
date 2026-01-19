# Your Memories

Your Memories is a local-first desktop app that captures and organizes personal memories with a private, on-device AI pipeline. It uses Electron + React for the UI and a native/LLM stack for extraction, embeddings, and search.

## Features

- Local-first storage with a desktop UI
- AI-powered extraction, embeddings, and memory retrieval
- Vision and text ingestion utilities
- Entity graph and memory feeds in the UI

## Tech Stack

- Electron + Vite
- React + TypeScript
- Node.js main process with native helpers
- Local LLM binaries and GGUF models

## Repository Structure

- src/main: Electron main process (database, embeddings, LLM, vision, watcher)
- src/renderer: React UI and components
- src/preload: Electron preload bridge
- resources/bin: Local LLM binaries
- resources/models: GGUF models used by the app

## Prerequisites

- Node.js 18+ (recommended)
- npm

## Setup

Install dependencies:

```bash
npm install
```

## Development

Start the app in development mode:

```bash
npm run dev
```

## Build

Build desktop packages:

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

## Models and Binaries

This repo includes local binaries in resources/bin and GGUF models in resources/models. If you change models or add new ones, ensure the main process configuration points to the correct paths.

## Scripts

Useful scripts live in scripts/ for model downloads and vision tests. See the folder for details and usage.

## Security and Privacy

Your Memories is designed to run locally and keep data on-device. Review the code in src/main for storage and ingestion details before using with sensitive data.

## License

Add a license file if you plan to distribute this project publicly.
