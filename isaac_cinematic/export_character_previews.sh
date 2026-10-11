#!/usr/bin/env bash
# Render character showcase frames with PBR USD materials and copy to assets/previews for GitHub.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
ISAACLAB_PATH="${ISAACLAB_PATH:-$HOME/IsaacLab}"
if [[ ! -x "$ISAACLAB_PATH/isaaclab.sh" ]]; then
  ISAACLAB_PATH="$HOME/isaac/IsaacLab"
fi
PREVIEWS="$REPO/assets/previews"
FRAMES="$ROOT/output/showcase_frames"
FFMPEG="${FFMPEG:-$HOME/.local/bin/ffmpeg}"
export TERM="${TERM:-xterm-256color}"
export OMNI_KIT_ACCEPT_EULA=YES ACCEPT_EULA=Y PRIVACY_CONSENT=Y
export VK_ICD_FILENAMES="${VK_ICD_FILENAMES:-/usr/share/vulkan/icd.d/nvidia_icd.json}"
export __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia __VK_LAYER_NV_optimus=NVIDIA_only

mkdir -p "$PREVIEWS" "$FRAMES"
rm -f "$FRAMES"/frame_*.png

# Ensure latest PBR USD
python3 "$REPO/assets/scripts/generate_usd_from_style.py"

cd "$ISAACLAB_PATH"
set +e
timeout 240 ./isaaclab.sh -p "$ROOT/deep_sea_cinematic.py" \
  --headless --enable_cameras --showcase \
  --frames 16 --width 720 --height 1280 \
  --out "$FRAMES" 2>&1 | tee "$ROOT/output/showcase_run.log"
set -e

COUNT=$(ls "$FRAMES"/frame_*.png 2>/dev/null | wc -l | tr -d ' ')
if [[ "$COUNT" -lt 3 ]]; then
  echo "[preview] ERROR: need frames, got $COUNT" >&2
  exit 2
fi

cp "$FRAMES/frame_0000.png" "$PREVIEWS/character_front.png"
cp "$FRAMES/frame_0004.png" "$PREVIEWS/character_orbit_a.png"
cp "$FRAMES/frame_0008.png" "$PREVIEWS/character_orbit_b.png"
cp "$FRAMES/frame_0012.png" "$PREVIEWS/character_orbit_c.png"
cp "$FRAMES/frame_0015.png" "$PREVIEWS/character_side.png" 2>/dev/null \
  || cp "$FRAMES/frame_$((COUNT-1)).png" "$PREVIEWS/character_side.png"

"$FFMPEG" -y -framerate 12 -i "$FRAMES/frame_%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart \
  "$PREVIEWS/character_orbit.mp4"

cat > "$PREVIEWS/README.md" <<'MD'
# Character previews (Isaac USD + PBR)

Rendered on Spark with Isaac Lab from generated `assets/usd/girl.usda` and `whale.usda`.

| File | View |
|------|------|
| `character_front.png` | Opening orbit angle |
| `character_orbit_a.png` … `c.png` | Material turnaround |
| `character_side.png` | Side / scale contrast |
| `character_orbit.mp4` | Short orbit clip |

Materials: UsdPreviewSurface skin / hair / dress / wet whale clearcoat.
MD

echo "[preview] wrote to $PREVIEWS"
ls -lh "$PREVIEWS"
