/**
 * Trading Fee Service
 * Handles 1% of total wallet balance as fee payment when user starts trading
 * Note: This service is kept for backward compatibility. The main fee logic is in /api/trading/pay-fee
 */

import { ethers } from 'ethers';

const FEE_AMOUNT_USD = 0.03; // Legacy: This is now calculated as 1% of wallet balance in the API
const FEE_RECIPIENT = '0xeb56286910d3Cf36Ba26958Be0BbC91D60B28799';

// USDC on Base (if available)
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base mainnet USDC
const USDC_DECIMALS = 6;

export interface FeePaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  amount: string;
  currency: 'ETH' | 'USDC';
}

export class TradingFeeService {
  /**
   * Get current ETH price in USD
   */
  private async getEthPrice(): Promise<number> {
    try {
      // Use CoinGecko API (free tier)
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      return data.ethereum?.usd || 2500; // Fallback to $2500 if API fails
    } catch (error) {
      console.warn('[TradingFeeService] Failed to fetch ETH price, using fallback:', error);
      return 2500; // Fallback price
    }
  }

  /**
   * Calculate ETH amount for fee (legacy - now uses 1% of wallet balance)
   */
  private async calculateEthAmount(): Promise<string> {
    const ethPrice = await this.getEthPrice();
    const ethAmount = FEE_AMOUNT_USD / ethPrice;
    // Add 10% buffer for gas
    const ethAmountWithBuffer = ethAmount * 1.1;
    return ethers.parseEther(ethAmountWithBuffer.toFixed(18)).toString();
  }

  /**
   * Calculate USDC amount for fee (legacy - now uses 1% of wallet balance)
   */
  private calculateUsdcAmount(): string {
    // USDC is 1:1 with USD
    return ethers.parseUnits('0.03', USDC_DECIMALS).toString();
  }

  /**
   * Check if user has USDC balance
   */
  private async checkUsdcBalance(provider: ethers.Provider, address: string): Promise<boolean> {
    try {
      const usdcAbi = ['function balanceOf(address owner) view returns (uint256)'];
      const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
      const balance = await usdcContract.balanceOf(address);
      const requiredAmount = this.calculateUsdcAmount();
      return BigInt(balance.toString()) >= BigInt(requiredAmount);
    } catch (error) {
      console.error('[TradingFeeService] Error checking USDC balance:', error);
      return false;
    }
  }

  /**
   * Pay fee using ETH (native token)
   */
  private async payFeeWithEth(
    provider: ethers.Provider,
    signer: ethers.Signer,
    fromAddress: string
  ): Promise<FeePaymentResult> {
    try {
      const ethAmount = await this.calculateEthAmount();
      
      // Check balance
      const balance = await provider.getBalance(fromAddress);
      if (BigInt(balance.toString()) < BigInt(ethAmount)) {
        return {
          success: false,
          error: 'Insufficient ETH balance to pay fee',
          amount: ethers.formatEther(ethAmount),
          currency: 'ETH'
        };
      }

      // Send transaction
      const tx = await signer.sendTransaction({
        to: FEE_RECIPIENT,
        value: ethAmount,
      });

      // Wait for confirmation
      await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash,
        amount: ethers.formatEther(ethAmount),
        currency: 'ETH'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pay fee with ETH',
        amount: '0',
        currency: 'ETH'
      };
    }
  }

  /**
   * Pay fee using USDC (ERC-20 token)
   */
  private async payFeeWithUsdc(
    provider: ethers.Provider,
    signer: ethers.Signer,
    fromAddress: string
  ): Promise<FeePaymentResult> {
    try {
      const usdcAmount = this.calculateUsdcAmount();
      
      // Check balance
      const hasBalance = await this.checkUsdcBalance(provider, fromAddress);
      if (!hasBalance) {
        return {
          success: false,
          error: 'Insufficient USDC balance to pay fee',
          amount: ethers.formatUnits(usdcAmount, USDC_DECIMALS),
          currency: 'USDC'
        };
      }

      // USDC transfer ABI
      const usdcAbi = [
        'function transfer(address to, uint256 amount) returns (bool)'
      ];
      const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);

      // Send transfer
      const tx = await usdcContract.transfer(FEE_RECIPIENT, usdcAmount);
      
      // Wait for confirmation
      await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash,
        amount: ethers.formatUnits(usdcAmount, USDC_DECIMALS),
        currency: 'USDC'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pay fee with USDC',
        amount: '0',
        currency: 'USDC'
      };
    }
  }

  /**
   * Pay trading fee - tries USDC first, then ETH
   */
  async payTradingFee(
    provider: ethers.Provider,
    signer: ethers.Signer,
    fromAddress: string
  ): Promise<FeePaymentResult> {
    try {
      // Try USDC first (cheaper, more stable)
      const hasUsdc = await this.checkUsdcBalance(provider, fromAddress);
      if (hasUsdc) {
        console.log('[TradingFeeService] Paying fee with USDC');
        const result = await this.payFeeWithUsdc(provider, signer, fromAddress);
        if (result.success) {
          return result;
        }
        console.warn('[TradingFeeService] USDC payment failed, trying ETH:', result.error);
      }

      // Fallback to ETH
      console.log('[TradingFeeService] Paying fee with ETH');
      return await this.payFeeWithEth(provider, signer, fromAddress);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pay trading fee',
        amount: '0',
        currency: 'ETH'
      };
    }
  }
}

