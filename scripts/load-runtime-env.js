#!/usr/bin/env node

/**
 * Runtime Environment Variable Loader
 * 
 * This script loads environment variables at runtime from:
 * 1. System environment variables (highest priority)
 * 2. .env.local file (if exists, for local development)
 * 3. .env file (if exists, fallback)
 * 
 * Usage in CI/CD:
 *   - Set environment variables in your CI/CD platform
 *   - Run: node scripts/load-runtime-env.js && npm start
 * 
 * Or use with PM2:
 *   - PM2 will automatically load .env files, but you can also set env vars in ecosystem.config.js
 */

const fs = require('fs');
const path = require('path');

/**
 * Load environment variables from a file
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};

  content.split('\n').forEach((line) => {
    line = line.trim();
    
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      return;
    }

    // Parse KEY=VALUE format
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Only set if not already in process.env (system env takes precedence)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });

  return env;
}

/**
 * Main function to load runtime environment
 */
function loadRuntimeEnv() {
  const rootDir = path.resolve(__dirname, '..');
  
  console.log('[RuntimeEnv] Loading environment variables...');
  
  // Priority order:
  // 1. System environment variables (already in process.env, highest priority)
  // 2. .env.local (for local development)
  // 3. .env (fallback)
  
  const envLocalPath = path.join(rootDir, '.env.local');
  const envPath = path.join(rootDir, '.env');
  
  let loadedCount = 0;
  
  // Load .env.local if it exists
  if (fs.existsSync(envLocalPath)) {
    const env = loadEnvFile(envLocalPath);
    loadedCount = Object.keys(env).length;
    console.log(`[RuntimeEnv] Loaded ${loadedCount} variables from .env.local`);
  } else {
    console.log('[RuntimeEnv] .env.local not found (this is OK for CI/CD)');
  }
  
  // Load .env if it exists and .env.local doesn't have the variable
  if (fs.existsSync(envPath)) {
    const env = loadEnvFile(envPath);
    const newVars = Object.keys(env).filter(key => !process.env[key]);
    if (newVars.length > 0) {
      console.log(`[RuntimeEnv] Loaded ${newVars.length} additional variables from .env`);
    }
  }
  
  // Log which variables are set (without values for security)
  const requiredVars = [
    'JWT_SECRET',
    'ENCRYPTION_SECRET',
    'TRADING_ENGINE_URL',
    'AVANTIS_API_URL',
    'AVANTIS_NETWORK',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_AVANTIS_NETWORK',
  ];
  
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.warn(`[RuntimeEnv] ⚠️  Missing required variables: ${missingVars.join(', ')}`);
    console.warn('[RuntimeEnv] These should be set in your CI/CD environment or .env.local file');
  } else {
    console.log('[RuntimeEnv] ✅ All required variables are set');
  }
  
  // Log optional variables status
  const optionalVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];
  
  const setOptionalVars = optionalVars.filter(v => process.env[v]);
  console.log(`[RuntimeEnv] Optional variables set: ${setOptionalVars.length}/${optionalVars.length}`);
  
  return process.env;
}

// If run directly, load the environment
if (require.main === module) {
  loadRuntimeEnv();
}

module.exports = { loadRuntimeEnv, loadEnvFile };

