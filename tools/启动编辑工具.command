#!/bin/zsh
cd -- "$(dirname -- "$0")/.." || exit 1
exec python3 tools/editor_server.py --open
