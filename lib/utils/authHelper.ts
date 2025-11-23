/**
 * Authentication Helper Utilities
 * 
 * Helps determine authentication context and extract user info from tokens
 */

import { AuthService } from '@/lib/services/AuthService';
import { WebAuthService } from '@/lib/services/WebAuthService';

const authService = new AuthService();
const webAuthService = new WebAuthService();

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
  // Try Farcaster token first
  try {
    const payload = await authService.verifyToken(token);
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
    const payload = await webAuthService.verifyToken(token);
    return {
      context: 'web',
      webUserId: payload.webUserId,
      userId: payload.userId,
    };
  } catch (error) {
    throw new Error('Invalid token');
  }
}

