/**
 * Authentication Helper Utilities
 * 
 * Helps determine authentication context and extract user info from tokens
 */

import { AuthService } from '@/lib/services/AuthService';
import { WebAuthService } from '@/lib/services/WebAuthService';

// Lazy-load services to avoid requiring JWT_SECRET at build time
let authService: AuthService | null = null;
let webAuthService: WebAuthService | null = null;

function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

function getWebAuthService(): WebAuthService {
  if (!webAuthService) {
    webAuthService = new WebAuthService();
  }
  return webAuthService;
}

export interface AuthContextResult {
  context: 'farcaster' | 'web';
  fid?: number;
  webUserId?: number;
  userId: string;
}

/**
 * Verify token and determine authentication context
 * Tries Farcaster token first, then falls back to web token
 */
export async function verifyTokenAndGetContext(token: string): Promise<AuthContextResult> {
  const authServiceInstance = getAuthService();
  const webAuthServiceInstance = getWebAuthService();

  // Try Farcaster token first
  try {
    const payload = await authServiceInstance.verifyToken(token);
    if (payload.fid) {
      console.log('[authHelper] ✅ Verified as Farcaster token, FID:', payload.fid);
      return {
        context: 'farcaster',
        fid: payload.fid,
        userId: payload.userId,
      };
    }
  } catch (farcasterError) {
    // Log but don't throw - this might be a web token, so try that next
    const errorMessage = farcasterError instanceof Error ? farcasterError.message : String(farcasterError);
    console.log('[authHelper] Farcaster token verification failed (will try web token):', errorMessage);
    // Continue to try web token - don't throw here
  }

  // Try web token (fallback for web users)
  try {
    const payload = await webAuthServiceInstance.verifyToken(token);
    console.log('[authHelper] ✅ Verified as web token, webUserId:', payload.webUserId);
    return {
      context: 'web',
      webUserId: payload.webUserId,
      userId: payload.userId,
    };
  } catch (webError) {
    const errorMessage = webError instanceof Error ? webError.message : String(webError);
    console.error('[authHelper] ❌ Both token verifications failed');
    console.error('[authHelper] Farcaster error: (logged above)');
    console.error('[authHelper] Web error:', errorMessage);
    
    // Provide more specific error message based on the web token error
    if (errorMessage.includes('expired') || errorMessage.includes('Token expired')) {
      throw new Error('Token expired. Please refresh your session.');
    }
    
    if (errorMessage.includes('Invalid token') || errorMessage.includes('invalid') || errorMessage.includes('jwt')) {
      throw new Error('Invalid token. Please log in again.');
    }
    
    // Generic error if both failed
    throw new Error('Token verification failed. Please log in again.');
  }
}

