#!/usr/bin/env bash
set -euo pipefail

APP_NAME="boardom"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_MIN="18"

echo "=== Boardom PM2 Deployment ==="

# ── Check Node.js ──
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed."
  echo "Install it via: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt "$NODE_MIN" ]; then
  echo "Error: Node.js >= $NODE_MIN required (found v$(node -v))"
  exit 1
fi

echo "Node.js $(node -v) ✓"

# ── Install PM2 globally if missing ──
if ! command -v pm2 &>/dev/null; then
  echo "Installing PM2 globally..."
  npm install -g pm2
fi

echo "PM2 $(pm2 -v) ✓"

# ── Install dependencies ──
cd "$APP_DIR"
echo "Installing dependencies..."
npm ci --production

# ── Create data directory ──
mkdir -p "$APP_DIR/data"

# ── Stop existing instance if running ──
if pm2 describe "$APP_NAME" &>/dev/null; then
  echo "Stopping existing $APP_NAME instance..."
  pm2 stop "$APP_NAME"
  pm2 delete "$APP_NAME"
fi

# ── Start with PM2 ──
echo "Starting $APP_NAME..."
pm2 start server.js \
  --name "$APP_NAME" \
  --cwd "$APP_DIR" \
  --max-memory-restart 512M \
  --env production \
  -- --color

# ── Save PM2 process list & set up startup hook ──
pm2 save

echo ""
echo "=== Deployment complete ==="
echo "  Status:   pm2 status $APP_NAME"
echo "  Logs:     pm2 logs $APP_NAME"
echo "  Restart:  pm2 restart $APP_NAME"
echo "  Stop:     pm2 stop $APP_NAME"
echo ""
echo "To auto-start on reboot, run:"
echo "  pm2 startup"
echo "  (then run the command it outputs)"
