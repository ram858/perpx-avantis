import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/AuthService';
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService';
import { RealBalanceService } from '@/lib/services/RealBalanceService';
import { ethers } from 'ethers';
import { getAvantisBalanceUSD } from '@/lib/wallet/avantisBalance';
import { getNetworkConfig } from '@/lib/config/network';

// Lazy initialization - create services at runtime, not build time
function getAuthService(): AuthService {
  return new AuthService();
}

function getWalletService(): BaseAccountWalletService {
  return new BaseAccountWalletService();
}

function getBalanceService(): RealBalanceService {
  return new RealBalanceService();
}

// Get network config at runtime
function getNetworkConfigRuntime() {
  return getNetworkConfig();
}

const FEE_PERCENTAGE = 0.01; // 1% of total wallet balance
const FEE_RECIPIENT = '0xeb56286910d3Cf36Ba26958Be0BbC91D60B28799';

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
 * Calculate total wallet balance in USD (ETH + tokens + Avantis)
 */
async function calculateTotalWalletBalance(fid: number, walletAddress: string): Promise<number> {
  try {
    // Get blockchain balances (ETH + tokens)
    const balanceData = await balanceService.getAllBalances(walletAddress);
    const blockchainBalance = balanceData.totalPortfolioValue + (parseFloat(balanceData.ethBalanceFormatted) * balanceData.ethPriceUSD);

    // Get Avantis balance if wallet has private key
    let avantisBalance = 0;
    try {
      const wallet = await walletService.getWalletWithKey(fid, 'ethereum');
      if (wallet?.privateKey) {
        avantisBalance = await getAvantisBalanceUSD(wallet.privateKey);
      }
    } catch (error) {
      console.warn('[API] Could not fetch Avantis balance:', error);
      // Continue without Avantis balance
    }

    const totalBalance = blockchainBalance + avantisBalance;
    console.log(`[API] Total wallet balance: $${totalBalance.toFixed(2)} (Blockchain: $${blockchainBalance.toFixed(2)}, Avantis: $${avantisBalance.toFixed(2)})`);
    
    return totalBalance;
  } catch (error) {
    console.error('[API] Error calculating total wallet balance:', error);
    throw new Error('Failed to calculate wallet balance');
  }
}

/**
 * Calculate ETH amount for fee (1% of total balance)
 */
async function calculateEthAmount(feeAmountUSD: number): Promise<string> {
  const ethPrice = await getEthPrice();
  const ethAmount = feeAmountUSD / ethPrice;
  const ethAmountWithBuffer = ethAmount * 1.1; // 10% buffer for gas
  return ethers.parseEther(ethAmountWithBuffer.toFixed(18)).toString();
}

/**
 * POST /api/trading/pay-fee - Pay 1% of total wallet balance as trading fee
 * This endpoint prepares the transaction data for the client to sign
 */
export async function POST(request: NextRequest) {
  try {
    const authService = getAuthService();
    const walletService = getWalletService();
    const balanceService = getBalanceService();
    
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

    // IMPORTANT: Only use trading wallet for fee payment, never use Base Account wallet
    // Get trading wallet - this is the wallet that should pay fees
    const tradingWallet = await walletService.ensureTradingWallet(payload.fid);

    if (!tradingWallet?.address) {
      return NextResponse.json(
        { error: 'Trading wallet not found. Please set up your trading wallet first.' },
        { status: 400 }
      );
    }

    // Get trading wallet with private key
    const wallet = await walletService.getWalletWithKey(payload.fid, 'ethereum');
    
    // Ensure we have a trading wallet with private key
    if (!wallet?.privateKey || wallet.privateKey.length === 0) {
      return NextResponse.json(
        { error: 'Trading wallet private key not available. Cannot pay fee.' },
        { status: 400 }
      );
    }
    
    const walletAddress = tradingWallet.address;
    const isBaseAccount = false; // Always use trading wallet, never Base Account for fees

    // Calculate total wallet balance (ETH + tokens + Avantis)
    const totalWalletBalance = await calculateTotalWalletBalance(payload.fid, walletAddress);
    
    // Calculate fee as 1% of total wallet balance
    const feeAmountUSD = totalWalletBalance * FEE_PERCENTAGE;
    
    // Minimum fee of $0.01 to avoid dust transactions
    const finalFeeAmountUSD = Math.max(feeAmountUSD, 0.01);
    
    console.log(`[API] Fee calculation: ${totalWalletBalance.toFixed(2)} * ${(FEE_PERCENTAGE * 100).toFixed(0)}% = $${finalFeeAmountUSD.toFixed(2)}`);

    // Calculate fee amounts in ETH and USDC
    const ethAmount = await calculateEthAmount(finalFeeAmountUSD);
    const networkConfig = getNetworkConfigRuntime();
    const usdcAmount = ethers.parseUnits(finalFeeAmountUSD.toFixed(networkConfig.usdcDecimals), networkConfig.usdcDecimals).toString();

    // Return transaction data for client to sign
    // Client will handle signing based on wallet type (Base Account vs fallback)
    return NextResponse.json({
      success: true,
      feeAmountUSD: finalFeeAmountUSD,
      feePercentage: FEE_PERCENTAGE * 100, // 1%
      totalWalletBalance,
      feeRecipient: FEE_RECIPIENT,
      isBaseAccount,
      transactions: {
        eth: {
          to: FEE_RECIPIENT,
          value: ethAmount,
          data: '0x',
        },
        usdc: {
          to: networkConfig.usdcAddress,
          value: '0x0',
          data: encodeUsdcTransfer(FEE_RECIPIENT, usdcAmount),
        },
      },
      amounts: {
        eth: ethers.formatEther(ethAmount),
        usdc: ethers.formatUnits(usdcAmount, networkConfig.usdcDecimals),
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

