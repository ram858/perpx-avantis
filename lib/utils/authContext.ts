/**
 * Authentication Context Detection Utility
 * 
 * Determines whether the current request is from Farcaster (Base context)
 * or from a web environment, and routes to appropriate services.
 */

export type AuthContext = 'farcaster' | 'web';

export interface AuthContextInfo {
  context: AuthContext;
  userId: string | number;
  fid?: number;
  webUserId?: number;
}

/**
 * Detect authentication context from request headers or environment
 */
export function detectAuthContext(request?: {
  headers?: Headers | Record<string, string>;
  url?: string;
}): AuthContext {
  // Check if we're in a Base/Farcaster context
  // This can be determined by:
  // 1. Presence of Base Account JWT token in headers
  // 2. Environment variable
  // 3. Request origin/headers
  
  if (typeof window !== 'undefined') {
    // Client-side: Check if Base SDK is available
    const isBaseContext = (window as any).base !== undefined;
    return isBaseContext ? 'farcaster' : 'web';
  }
  
  // Server-side: Check headers or environment
  if (request?.headers) {
    const headers = request.headers as any;
    const authHeader = typeof headers.get === 'function' 
      ? headers.get('authorization')
      : headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      // Check if it's a Base Account token (contains FID) or web JWT
      // For now, we'll use a simple heuristic: Base tokens are longer
      // In production, you'd decode and check the token type
      return 'farcaster'; // Default assumption for Bearer tokens
    }
  }
  
  // Check environment variable
  const authMode = process.env.AUTH_MODE || process.env.NEXT_PUBLIC_AUTH_MODE;
  if (authMode === 'web') {
    return 'web';
  }
  
  // Default to web for testing
  return 'web';
}

/**
 * Extract user identifier from request
 */
export function extractUserIdentifier(
  context: AuthContext,
  request?: {
    headers?: Headers | Record<string, string>;
  }
): { fid?: number; webUserId?: number; userId?: string } {
  if (context === 'farcaster') {
    // Extract FID from JWT token (would need to decode)
    // For now, return placeholder
    return {};
  } else {
    // Extract web user ID from JWT token
    return {};
  }
}

