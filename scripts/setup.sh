#!/usr/bin/env bash
set -e

echo "[setup] Installing server dependencies..."
cd server && npm install && cd ..

echo "[setup] Installing client dependencies..."
cd client && npm install && cd ..

echo "[setup] Installing root dependencies..."
npm install

echo "[setup] Bootstrapping .env files and generating cryptographic keys..."
npm run bootstrap

echo "[setup] Installing git hooks..."
cp scripts/@system/hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
cp scripts/@custom/post-merge .git/hooks/post-merge
chmod +x .git/hooks/post-merge
echo "[setup] Git hooks installed."

echo "[setup] Done. Fill in the remaining values in server/.env and client/.env, then run: npm run dev"
