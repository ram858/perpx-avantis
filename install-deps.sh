#!/bin/bash

echo "Installing enterprise authentication dependencies..."

# Clear npm cache
npm cache clean --force

# Remove existing node_modules and lock files
rm -rf node_modules package-lock.json

# Install core dependencies first
echo "Installing core dependencies..."
npm install typeorm@^0.3.20 pg@^8.11.3 jsonwebtoken@^9.0.2

# Install additional dependencies
echo "Installing additional dependencies..."
npm install twilio@^4.19.0 ethers@^6.15.0 reflect-metadata@^0.2.1

# Install crypto dependencies
echo "Installing crypto dependencies..."
npm install bip39@^3.1.0 bitcoinjs-lib@^6.1.5 bip32@^4.0.0 tiny-secp256k1@^1.1.6

# Install blockchain dependencies
echo "Installing blockchain dependencies..."
npm install @solana/web3.js@^1.87.6 ed25519-hd-key@^0.0.3 @aptos-labs/ts-sdk@^1.15.0

# Install type definitions
echo "Installing type definitions..."
npm install -D @types/pg@^8.10.9 @types/jsonwebtoken@^9.0.5 @types/bip39@^3.0.0

echo "Installation complete!"
