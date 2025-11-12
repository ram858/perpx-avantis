import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/AuthService';
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService';
import { ethers } from 'ethers';

const authService = new AuthService();
const walletService = new BaseAccountWalletService();

const FEE_AMOUNT_USD = 0.03;
const FEE_RECIPIENT = '0xeb56286910d3Cf36Ba26958Be0BbC91D60B28799';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base mainnet USDC
const USDC_DECIMALS = 6;

/**
 * Get current ETH price
 */
async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum?.usd || 2500;
  } catch (error) {
    console.warn('[API] Failed to fetch ETH price, using fallback');
    return 2500;
  }
}

/**
 * Calculate ETH amount for $0.03 fee
 */
async function calculateEthAmount(): Promise<string> {
  const ethPrice = await getEthPrice();
  const ethAmount = FEE_AMOUNT_USD / ethPrice;
  const ethAmountWithBuffer = ethAmount * 1.1; // 10% buffer
  return ethers.parseEther(ethAmountWithBuffer.toFixed(18)).toString();
}

/**
 * POST /api/trading/pay-fee - Pay $0.03 trading fee
 * This endpoint prepares the transaction data for the client to sign
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await authService.verifyToken(token);

    if (!payload.fid) {
      return NextResponse.json(
        { error: 'Base Account (FID) required' },
        { status: 400 }
      );
    }

    // Get user's wallet address
    const walletAddress = await walletService.getWalletAddress(payload.fid, 'ethereum');
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'No wallet found for user' },
        { status: 400 }
      );
    }

    // Get wallet with private key (for fallback wallets)
    const wallet = await walletService.getWalletWithKey(payload.fid, 'ethereum');
    const isBaseAccount = !wallet?.privateKey || wallet.privateKey.length === 0;

    // Calculate fee amounts
    const ethAmount = await calculateEthAmount();
    const usdcAmount = ethers.parseUnits('0.03', USDC_DECIMALS).toString();

    // Return transaction data for client to sign
    // Client will handle signing based on wallet type (Base Account vs fallback)
    return NextResponse.json({
      success: true,
      feeAmountUSD: FEE_AMOUNT_USD,
      feeRecipient: FEE_RECIPIENT,
      isBaseAccount,
      transactions: {
        eth: {
          to: FEE_RECIPIENT,
          value: ethAmount,
          data: '0x',
        },
        usdc: {
          to: USDC_ADDRESS,
          value: '0x0',
          data: encodeUsdcTransfer(FEE_RECIPIENT, usdcAmount),
        },
      },
      amounts: {
        eth: ethers.formatEther(ethAmount),
        usdc: ethers.formatUnits(usdcAmount, USDC_DECIMALS),
      },
    });
  } catch (error) {
    console.error('[API] Error preparing fee payment:', error);
    return NextResponse.json(
      {
        error: 'Failed to prepare fee payment',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * Encode USDC transfer function call
 */
function encodeUsdcTransfer(to: string, amount: string): string {
  const iface = new ethers.Interface([
    'function transfer(address to, uint256 amount) returns (bool)',
  ]);
  return iface.encodeFunctionData('transfer', [to, amount]);
}

