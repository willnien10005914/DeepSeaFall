#!/usr/bin/env bash
set -euo pipefail
DIVE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIVE_NODE="$(command -v node)"
DIVE_PYTHON="${DEEPSEA_PYTHON:-/home/spark/env_isaaclab/bin/python}"
test -x "$DIVE_PYTHON" || { echo 'Set DEEPSEA_PYTHON to a CUDA-enabled Python environment.' >&2; exit 1; }
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/deep-sea-fall-gpu.service" <<EOF
[Unit]
Description=Deep Sea Fall Spark CUDA swimming and voice worker
[Service]
WorkingDirectory=$DIVE_ROOT
EnvironmentFile=-$DIVE_ROOT/.env
ExecStart=$DIVE_PYTHON -u server/gpu_worker.py
Restart=on-failure
RestartSec=5
TimeoutStopSec=15
[Install]
WantedBy=default.target
EOF
cat > "$HOME/.config/systemd/user/deep-sea-fall.service" <<EOF
[Unit]
Description=Deep Sea Fall authoritative multiplayer sea
Requires=deep-sea-fall-gpu.service
After=deep-sea-fall-gpu.service
[Service]
WorkingDirectory=$DIVE_ROOT
EnvironmentFile=-$DIVE_ROOT/.env
ExecStart=$DIVE_NODE server/index.mjs
Restart=on-failure
RestartSec=5
TimeoutStopSec=15
[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now deep-sea-fall-gpu.service deep-sea-fall.service
echo 'Multiplayer sea installed. Check: curl http://127.0.0.1:8765/api/health'
