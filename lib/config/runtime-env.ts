/**
 * Runtime Environment Configuration
 * 
 * This module provides runtime access to environment variables,
 * allowing CI/CD systems to inject variables at runtime rather than build time.
 * 
 * For client-side usage, it fetches config from the /api/config endpoint.
 * For server-side usage, it reads directly from process.env.
 */

// Client-side config cache
let clientConfig: Record<string, any> | null = null;
let configPromise: Promise<Record<string, any>> | null = null;

/**
 * Get runtime environment variables for client-side
 * Fetches from /api/config endpoint which reads from process.env at runtime
 */
export async function getRuntimeConfig(): Promise<Record<string, any>> {
  // If we already have the config, return it
  if (clientConfig) {
    return clientConfig;
  }

  // If a request is already in progress, wait for it
  if (configPromise) {
    return configPromise;
  }

  // Fetch config from API endpoint
  configPromise = fetch('/api/config')
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch runtime config: ${res.statusText}`);
      }
      return res.json();
    })
    .then((config) => {
      clientConfig = config;
      return config;
    })
    .catch((error) => {
      console.error('[RuntimeEnv] Failed to load runtime config:', error);
      // Return fallback values from window if available (for SSR compatibility)
      return getFallbackConfig();
    })
    .finally(() => {
      configPromise = null;
    });

  return configPromise;
}

/**
 * Get a specific runtime config value (client-side)
 */
export async function getRuntimeEnv(key: string): Promise<string | undefined> {
  const config = await getRuntimeConfig();
  return config[key];
}

/**
 * Get runtime environment variables for server-side
 * Reads directly from process.env
 */
export function getServerRuntimeEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * Get all server-side runtime environment variables
 */
export function getServerRuntimeConfig(): Record<string, string | undefined> {
  return {
    JWT_SECRET: process.env.JWT_SECRET,
    ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
    TRADING_ENGINE_URL: process.env.TRADING_ENGINE_URL,
    AVANTIS_API_URL: process.env.AVANTIS_API_URL,
    AVANTIS_NETWORK: process.env.AVANTIS_NETWORK,
    JWT_EXPIRATION_TIME: process.env.JWT_EXPIRATION_TIME,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    // Client-side variables (also available server-side)
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_AVANTIS_NETWORK: process.env.NEXT_PUBLIC_AVANTIS_NETWORK,
    NEXT_PUBLIC_AVANTIS_API_URL: process.env.NEXT_PUBLIC_AVANTIS_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ENABLE_WEB_MODE: process.env.NEXT_PUBLIC_ENABLE_WEB_MODE,
  };
}

/**
 * Fallback config for SSR compatibility
 */
function getFallbackConfig(): Record<string, any> {
  // Try to get from window if available (shouldn't happen in SSR, but just in case)
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) {
    return (window as any).__RUNTIME_CONFIG__;
  }

  // Return empty config as fallback
  return {};
}

/**
 * Initialize runtime config (call this in your app initialization)
 * This can be used to inject config into window for immediate access
 */
export function initializeRuntimeConfig(config: Record<string, any>) {
  if (typeof window !== 'undefined') {
    (window as any).__RUNTIME_CONFIG__ = config;
    clientConfig = config;
  }
}

