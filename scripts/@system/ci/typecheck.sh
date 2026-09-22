#!/bin/bash
set -e

echo "Checking client TypeScript..."
cd client
npx tsc --noEmit

echo "Checking server TypeScript..."
cd ../server
npx tsc --noEmit

echo "All TypeScript checks passed"
