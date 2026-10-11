#!/usr/bin/env bash
# Render Deep Sea Fall cinematic frames with Isaac Lab / Isaac Sim, then mux MP4.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
ISAACLAB_PATH="${ISAACLAB_PATH:-$HOME/IsaacLab}"
if [[ ! -x "$ISAACLAB_PATH/isaaclab.sh" ]]; then
  ISAACLAB_PATH="$HOME/isaac/IsaacLab"
fi
OUT="$ROOT/output"
FRAMES_DIR="$OUT/frames"
VIDEO="$OUT/deep_sea_isaac_cinematic.mp4"
FFMPEG="${FFMPEG:-$HOME/.local/bin/ffmpeg}"
NUM_FRAMES="${1:-90}"

# isaaclab.sh runs `tabs 4` under `set -e`; dumb terminals abort without TERM.
export TERM="${TERM:-xterm-256color}"
export OMNI_KIT_ACCEPT_EULA=YES ACCEPT_EULA=Y PRIVACY_CONSENT=Y
export VK_ICD_FILENAMES="${VK_ICD_FILENAMES:-/usr/share/vulkan/icd.d/nvidia_icd.json}"
export __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia __VK_LAYER_NV_optimus=NVIDIA_only

mkdir -p "$FRAMES_DIR"
rm -f "$FRAMES_DIR"/frame_*.png

echo "[run] IsaacLab=$ISAACLAB_PATH frames=$NUM_FRAMES"
cd "$ISAACLAB_PATH"
# Avoid piping through `tail` (buffers forever). Log to file + stdout.
./isaaclab.sh -p "$ROOT/deep_sea_cinematic.py" \
  --headless --enable_cameras \
  --frames "$NUM_FRAMES" \
  --width 720 --height 1280 \
  --out "$FRAMES_DIR" 2>&1 | tee "$OUT/isaac_run.log"

if [[ ! -f "$FRAMES_DIR/frame_0000.png" ]]; then
  echo "[run] ERROR: no frames written" >&2
  exit 2
fi

"$FFMPEG" -y -framerate 30 -i "$FRAMES_DIR/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart \
  "$VIDEO"

echo "[run] video: $VIDEO"
ls -lh "$VIDEO"
