import { NextRequest, NextResponse } from 'next/server';
import { createClient, Errors } from '@farcaster/quick-auth';
import { AuthService } from '@/lib/services/AuthService';
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService';

// Domain must match your mini app's deployment domain
// This will be set via environment variable in production
const domain = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'localhost:3000';
const client = createClient();
const authService = new AuthService();
const walletService = new BaseAccountWalletService();

/**
 * Verify Base Account JWT token and return user FID + JWT token
 * This endpoint is called by the frontend after getting a token from Base Account
 */
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', fid: null },
        { status: 401 }
      );
    }

    const baseToken = authorization.split(' ')[1];

    try {
      // Verify the JWT token from Base Account
      const payload = await client.verifyJwt({ token: baseToken, domain });
      const fid = payload.sub;

      // Create or get user by FID (no database needed - just for internal tracking)
      const user = await authService.createUserByFid(fid);

      // Get Base Account address from token payload if available
      // Note: Base Account address might be in the token payload or need to be fetched separately
      const address = (payload as any).address || null;

      // If we have an address, store it as the user's Base Account address
      if (address) {
        try {
          await walletService.storeBaseAccountAddress(fid, address, 'ethereum');
          console.log(`[API] Stored Base Account address for FID ${fid}: ${address}`);
        } catch (error) {
          console.error(`[API] Failed to store Base Account address:`, error);
          // Continue anyway - address might already be stored
        }
      }

      // Generate our own JWT token for API requests
      const internalToken = await authService.generateJwtToken({
        userId: user.id,
        fid: fid,
      });

      // Return the Farcaster ID (FID), address, and internal JWT token
      return NextResponse.json({
        fid: fid,
        userId: user.id,
        address: address, // Base Account address (if available in token)
        token: internalToken, // Our internal JWT for API calls
        success: true,
      });
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        return NextResponse.json(
          { error: 'Invalid token', fid: null },
          { status: 401 }
        );
      }
      throw e;
    }
  } catch (error) {
    console.error('Base Account auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed', fid: null },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for compatibility with SDK fetch
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

