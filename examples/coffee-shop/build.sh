#!/bin/bash
echo "Installing server dependencies..."
cd ../../packages/server
npm install

echo "Installing example dependencies..."
cd ../../examples/coffee-shop
npm install

echo "Build complete!"