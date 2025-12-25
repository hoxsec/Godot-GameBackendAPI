#!/bin/bash

echo "🚀 Starting GameBackend API..."
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null
then
    echo "❌ Bun is not installed. Installing dependencies with npm instead..."
    npm install
    npm run dev
else
    echo "✅ Bun detected"
    echo "📦 Installing dependencies..."
    bun install
    echo ""
    echo "🔥 Starting development server..."
    bun dev
fi

