#!/usr/bin/env node

/**
 * Generate build information file with timestamp
 * This file is used to display deployment information in the UI
 */

const fs = require('fs');
const path = require('path');

const buildInfo = {
  timestamp: new Date().toISOString(),
  buildTime: new Date().toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }),
  // Get git commit hash if available
  commitHash: process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  // Get build number from CI/CD if available
  buildNumber: process.env.BUILD_NUMBER || process.env.VERCEL_DEPLOYMENT_ID || Date.now().toString(36)
};

const outputPath = path.join(__dirname, '..', 'public', 'build-info.json');

// Ensure public directory exists
const publicDir = path.dirname(outputPath);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write build info to JSON file
fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2), 'utf8');

console.log('✓ Build info generated:', buildInfo.buildTime);
console.log('  Commit:', buildInfo.commitHash);
console.log('  Build:', buildInfo.buildNumber);

