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
 */
export async function verifyTokenAndGetContext(token: string): Promise<AuthContextResult> {
  const authServiceInstance = getAuthService();
  const webAuthServiceInstance = getWebAuthService();

  // Try Farcaster token first
  try {
    const payload = await authServiceInstance.verifyToken(token);
    if (payload.fid) {
      return {
        context: 'farcaster',
        fid: payload.fid,
        userId: payload.userId,
      };
    }
  } catch (error) {
    // Not a Farcaster token, try web token
  }

  // Try web token
  try {
    const payload = await webAuthServiceInstance.verifyToken(token);
    return {
      context: 'web',
      webUserId: payload.webUserId,
      userId: payload.userId,
    };
  } catch (error) {
    throw new Error('Invalid token');
  }
}

