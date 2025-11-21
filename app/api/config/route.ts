import { NextResponse } from 'next/server';

/**
 * Runtime configuration endpoint
 * Returns client-side environment variables at runtime
 * This allows CI/CD to inject environment variables without rebuilding
 */
export async function GET() {
  // Only expose variables that are safe for client-side
  const config = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
    NEXT_PUBLIC_AVANTIS_NETWORK: process.env.NEXT_PUBLIC_AVANTIS_NETWORK || '',
    NEXT_PUBLIC_AVANTIS_API_URL: process.env.NEXT_PUBLIC_AVANTIS_API_URL || '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || '',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    NEXT_PUBLIC_ENABLE_WEB_MODE: process.env.NEXT_PUBLIC_ENABLE_WEB_MODE === 'true',
    NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL || '',
    NEXT_PUBLIC_BASE_TESTNET_RPC_URL: process.env.NEXT_PUBLIC_BASE_TESTNET_RPC_URL || '',
  };

  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

