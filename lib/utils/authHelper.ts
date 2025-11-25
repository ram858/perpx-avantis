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
    // Log the specific error for Farcaster token verification
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('[authHelper] Farcaster token verification failed:', errorMessage);
    
    // If it's a token expiration error, provide more specific message
    if (errorMessage.includes('expired') || errorMessage.includes('Token expired')) {
      throw new Error('Token expired. Please refresh your session.');
    }
    
    // If it's an invalid token error, provide more specific message
    if (errorMessage.includes('Invalid token') || errorMessage.includes('invalid')) {
      throw new Error('Invalid Farcaster token. Please log in again.');
    }
    
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('[authHelper] Web token verification failed:', errorMessage);
    
    // Provide more specific error message
    if (errorMessage.includes('expired') || errorMessage.includes('Token expired')) {
      throw new Error('Token expired. Please refresh your session.');
    }
    
    if (errorMessage.includes('Invalid token') || errorMessage.includes('invalid')) {
      throw new Error('Invalid web token. Please log in again.');
    }
    
    throw new Error('Invalid token: Token verification failed for both Farcaster and web tokens.');
  }
}

