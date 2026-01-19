#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWIFT_BIN="swiftc"
ENTRY="$ROOT_DIR/text-extractor/main.swift"
CORE="$ROOT_DIR/text-extractor.swift"
COMMON="$ROOT_DIR/text-extractor/common.swift"
CLAUDE="$ROOT_DIR/text-extractor/claude.swift"
GENERIC="$ROOT_DIR/text-extractor/generic.swift"
CHATGPT="$ROOT_DIR/text-extractor/chatgpt.swift"
GEMINI="$ROOT_DIR/text-extractor/gemini.swift"

OUT="/tmp/your-memories-text-extractor"

"$SWIFT_BIN" -emit-executable "$ENTRY" "$CORE" "$COMMON" "$CLAUDE" "$GENERIC" "$CHATGPT" "$GEMINI" -o "$OUT"
exec "$OUT" "$@"
