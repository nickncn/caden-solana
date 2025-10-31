#!/bin/bash

echo "🚀 Deploying Seam Program to Dev-Net..."

# Check if we're on dev-net
echo "📡 Checking network configuration..."
solana config get

# Check SOL balance
echo "💰 Checking SOL balance..."
solana balance

# Build the program
echo "🔨 Building Anchor program..."
anchor build

# Deploy the program
echo "🚀 Deploying to dev-net..."
anchor deploy

# Get the program ID
echo "📋 Program deployed! Program ID:"
cat target/deploy/seam-keypair.json | jq -r '.[]' | base58

echo "✅ Deployment complete!"
echo "🔗 Update the program ID in the frontend if it changed."
