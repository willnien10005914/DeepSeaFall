#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TOOL_DIR="${DEEPSEA_BLENDER_TOOLS:-/tmp/deepsea-tools}"
BLENDER_PATH="${DEEPSEA_BLENDER_BIN:-$TOOL_DIR/blender/cmake-make/bin/blender}"
export LD_LIBRARY_PATH="$TOOL_DIR/libraries/usr/lib:$TOOL_DIR/libraries/usr/lib/aarch64-linux-gnu:$TOOL_DIR/libraries/usr/lib/aarch64-linux-gnu/blas:$TOOL_DIR/libraries/usr/lib/aarch64-linux-gnu/lapack:$TOOL_DIR/blender/cmake-make/libExt:${LD_LIBRARY_PATH:-}"
SCRIPT_PATH="$PROJECT_DIR/assets/scripts/build_refined_girl_blender.py"
if [[ "${1:-}" == "--inspect" ]]; then
  SCRIPT_PATH="$PROJECT_DIR/assets/scripts/inspect_groom.py"
  shift
fi
exec "$BLENDER_PATH" --background --python "$SCRIPT_PATH" -- "$@"
