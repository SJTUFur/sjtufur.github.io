#!/bin/zsh
cd -- "$(dirname -- "$0")/.."
exec python3 tools/editor_server.py --open
