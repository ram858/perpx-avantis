"use client";

import { useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useBaseMiniApp } from './useBaseMiniApp';
import { useIntegratedWallet } from '../wallet/IntegratedWalletContext';
import { ethers } from 'ethers';
import { BaseAccountTransactionService } from '../services/BaseAccountTransactionService';

const FEE_RECIPIENT = '0xeb56286910d3Cf36Ba26958Be0BbC91D60B28799';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base mainnet USDC
const USDC_DECIMALS = 6;

export interface FeePaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  amount: string;
  currency: 'ETH' | 'USDC';
}

export function useTradingFee() {
  const { token } = useAuth();
  const { sdk, isBaseContext } = useBaseMiniApp();
  const { primaryWallet } = useIntegratedWallet();
  const [isPayingFee, setIsPayingFee] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);

  /**
   * Get fee payment transaction data from API
   */
  const getFeeTransactionData = useCallback(async () => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/trading/pay-fee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get fee transaction data');
    }

    return response.json();
  }, [token]);

  /**
   * Pay fee using Base Account SDK
   */
  const payFeeWithBaseAccount = useCallback(async (txData: any): Promise<FeePaymentResult> => {
    if (!sdk || !isBaseContext) {
      throw new Error('Base Account SDK not available');
    }

    try {
      const transactionService = new BaseAccountTransactionService(sdk);
      
      // Try USDC first, then ETH
      let result: FeePaymentResult | null = null;

      // Try USDC transfer first (if user has USDC)
      try {
        // Check if we should try USDC (you can add balance check here if needed)
        const usdcTx = await transactionService.signAndSendTransaction({
          to: txData.transactions.usdc.to,
          value: txData.transactions.usdc.value,
          data: txData.transactions.usdc.data,
        });
        
        result = {
          success: true,
          transactionHash: usdcTx,
          amount: txData.amounts.usdc,
          currency: 'USDC',
        };
      } catch (usdcError) {
        console.warn('[useTradingFee] USDC payment failed, trying ETH:', usdcError);
        
        // Fallback to ETH
        try {
          const ethTx = await transactionService.signAndSendTransaction({
            to: txData.transactions.eth.to,
            value: txData.transactions.eth.value,
            data: txData.transactions.eth.data || '0x',
          });
          
          result = {
            success: true,
            transactionHash: ethTx,
            amount: txData.amounts.eth,
            currency: 'ETH',
          };
        } catch (ethError) {
          throw new Error(`Both USDC and ETH payment failed. ETH error: ${ethError instanceof Error ? ethError.message : 'Unknown'}`);
        }
      }

      if (!result) {
        throw new Error('Failed to pay fee');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pay fee with Base Account',
        amount: '0',
        currency: 'ETH',
      };
    }
  }, [sdk, isBaseContext]);

  /**
   * Pay fee using fallback wallet (with private key)
   */
  const payFeeWithFallbackWallet = useCallback(async (txData: any): Promise<FeePaymentResult> => {
    if (!primaryWallet?.privateKey) {
      throw new Error('No private key available for fee payment');
    }

    try {
      // Connect to Base network
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const wallet = new ethers.Wallet(primaryWallet.privateKey, provider);

      // Try USDC first
      try {
        const usdcAbi = ['function transfer(address to, uint256 amount) returns (bool)'];
        const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);
        
        // Check balance
        const balance = await usdcContract.balanceOf(wallet.address);
        const requiredAmount = ethers.parseUnits('0.03', USDC_DECIMALS);
        
        if (BigInt(balance.toString()) >= BigInt(requiredAmount.toString())) {
          const tx = await usdcContract.transfer(FEE_RECIPIENT, requiredAmount);
          await tx.wait();
          
          return {
            success: true,
            transactionHash: tx.hash,
            amount: '0.03',
            currency: 'USDC',
          };
        }
      } catch (usdcError) {
        console.warn('[useTradingFee] USDC payment failed, trying ETH:', usdcError);
      }

      // Fallback to ETH
      const ethAmount = txData.transactions.eth.value;
      const balance = await provider.getBalance(wallet.address);
      
      if (BigInt(balance.toString()) < BigInt(ethAmount)) {
        throw new Error('Insufficient ETH balance to pay fee');
      }

      const tx = await wallet.sendTransaction({
        to: FEE_RECIPIENT,
        value: ethAmount,
      });

      await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash,
        amount: txData.amounts.eth,
        currency: 'ETH',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pay fee with fallback wallet',
        amount: '0',
        currency: 'ETH',
      };
    }
  }, [primaryWallet]);

  /**
   * Pay trading fee - main function
   */
  const payTradingFee = useCallback(async (): Promise<FeePaymentResult> => {
    setIsPayingFee(true);
    setFeeError(null);

    try {
      // Get transaction data from API
      const txData = await getFeeTransactionData();

      // Determine payment method based on wallet type
      let result: FeePaymentResult;

      if (txData.isBaseAccount && isBaseContext && sdk) {
        // Use Base Account SDK
        result = await payFeeWithBaseAccount(txData);
      } else if (primaryWallet?.privateKey) {
        // Use fallback wallet with private key
        result = await payFeeWithFallbackWallet(txData);
      } else {
        throw new Error('No payment method available');
      }

      if (!result.success) {
        setFeeError(result.error || 'Failed to pay fee');
        throw new Error(result.error || 'Failed to pay fee');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pay trading fee';
      setFeeError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsPayingFee(false);
    }
  }, [token, sdk, isBaseContext, primaryWallet, getFeeTransactionData, payFeeWithBaseAccount, payFeeWithFallbackWallet]);

  return {
    payTradingFee,
    isPayingFee,
    feeError,
  };
}

