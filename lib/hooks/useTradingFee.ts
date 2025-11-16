"use client";

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useBaseMiniApp } from './useBaseMiniApp';
import { useIntegratedWallet } from '../wallet/IntegratedWalletContext';
import { useUILogger } from './useUILogger';
import { ethers } from 'ethers';
import { BaseAccountTransactionService } from '../services/BaseAccountTransactionService';
import { getNetworkConfig } from '../config/network';

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

interface WalletWithKey {
  address: string;
  privateKey?: string;
  chain: string;
}

export function useTradingFee() {
  const { token } = useAuth();
  const { sdk, isBaseContext } = useBaseMiniApp();
  const { primaryWallet, tradingWallet } = useIntegratedWallet();
  const { addLog } = useUILogger();
  const [isPayingFee, setIsPayingFee] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [tradingWalletWithKey, setTradingWalletWithKey] = useState<WalletWithKey | null>(null);

  // Fetch trading wallet with private key when needed
  useEffect(() => {
    // Only fetch if we have both token AND a trading wallet exists in context
    // This prevents fetching during initial wallet creation
    if (!token || !tradingWallet?.address) {
      return;
    }
    
    const fetchTradingWalletWithKey = async () => {
      addLog('info', 'Fetching trading wallet with private key...');
      
      try {
        const response = await fetch('/api/wallet/primary-with-key', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        addLog('info', `API response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          addLog('info', 'API response received', {
            hasWallet: !!data.wallet,
            address: data.wallet?.address,
            hasPrivateKey: !!data.wallet?.privateKey,
            privateKeyLength: data.wallet?.privateKey?.length || 0
          });
          
          if (data.wallet && data.wallet.privateKey) {
            setTradingWalletWithKey(data.wallet);
            addLog('success', `Successfully loaded trading wallet with private key: ${data.wallet.address.slice(0, 10)}...`);
          } else {
            addLog('warning', 'Wallet exists but no private key yet (may be creating)');
          }
        } else if (response.status === 404) {
          // Wallet not found yet - this is OK during initial creation
          addLog('warning', 'Trading wallet not found yet (may be creating)');
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          addLog('error', `API request failed: ${response.status}`, errorData);
        }
      } catch (error) {
        addLog('error', 'Exception during wallet fetch', error);
      }
    };

    // Add a small delay to prevent race conditions during wallet creation
    const timeoutId = setTimeout(() => {
      fetchTradingWalletWithKey();
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [token, tradingWallet?.address]);

  // Use trading wallet with private key if available, otherwise fall back to primary wallet
  const walletForFee = tradingWalletWithKey || tradingWallet || primaryWallet;

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
    if (!walletForFee?.privateKey) {
      throw new Error('No private key available for fee payment');
    }

    try {
      // Connect to Base network
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const wallet = new ethers.Wallet(walletForFee.privateKey, provider);

      // Try USDC first
      try {
        const usdcAbi = ['function transfer(address to, uint256 amount) returns (bool)'];
        const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);
        
        // Get required amount from transaction data (1% of wallet balance)
        const requiredAmount = ethers.parseUnits(txData.amounts.usdc, USDC_DECIMALS);
        
        // Check balance
        const balance = await usdcContract.balanceOf(wallet.address);
        
        if (BigInt(balance.toString()) >= BigInt(requiredAmount.toString())) {
          const tx = await usdcContract.transfer(FEE_RECIPIENT, requiredAmount);
          await tx.wait();
          
          return {
            success: true,
            transactionHash: tx.hash,
            amount: txData.amounts.usdc,
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
  }, [walletForFee]);

  /**
   * Fetch trading wallet with private key on-demand
   */
  const fetchWalletWithKeyOnDemand = useCallback(async (): Promise<WalletWithKey | null> => {
    if (!token) {
      addLog('warning', 'No token for on-demand fetch');
      return null;
    }

    // If we already have it, return it
    if (tradingWalletWithKey?.privateKey) {
      addLog('info', 'Already have wallet with private key');
      return tradingWalletWithKey;
    }

    // Try to fetch it
    addLog('info', 'Fetching wallet with private key on-demand...');
    
    try {
      const response = await fetch('/api/wallet/primary-with-key', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.wallet && data.wallet.privateKey) {
          // Validate private key format
          if (data.wallet.privateKey.length === 66 && data.wallet.privateKey.startsWith('0x')) {
            addLog('success', 'On-demand fetch successful! Private key loaded.');
            setTradingWalletWithKey(data.wallet);
            return data.wallet;
          } else {
            addLog('error', 'Invalid private key format received', {
              length: data.wallet.privateKey.length,
              startsWith0x: data.wallet.privateKey.startsWith('0x')
            });
            return null;
          }
        } else {
          addLog('error', 'Wallet returned but no private key in response', {
            hasWallet: !!data.wallet,
            hasPrivateKey: !!data.wallet?.privateKey
          });
        }
      } else if (response.status === 404) {
        // Wallet doesn't exist - try to create it
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        addLog('warning', 'Trading wallet not found. Attempting to create...', errorData);
        
        // Try to create the wallet via API
        try {
          const createResponse = await fetch('/api/wallet/user-wallets', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ chain: 'ethereum' })
          });
          
          if (createResponse.ok) {
            addLog('success', 'Trading wallet created! Retrying fetch...');
            // Retry fetching after creation
            const retryResponse = await fetch('/api/wallet/primary-with-key', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              if (retryData.wallet && retryData.wallet.privateKey) {
                addLog('success', 'Wallet created and private key loaded!');
                setTradingWalletWithKey(retryData.wallet);
                return retryData.wallet;
              }
            }
          } else {
            const createError = await createResponse.json().catch(() => ({ error: 'Unknown error' }));
            addLog('error', 'Failed to create trading wallet', createError);
          }
        } catch (createError) {
          addLog('error', 'Exception while creating wallet', createError);
        }
      }
      
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      addLog('error', 'On-demand fetch failed', {
        status: response.status,
        error: errorData
      });
      return null;
    } catch (error) {
      addLog('error', 'On-demand fetch error', error);
      return null;
    }
  }, [token, tradingWalletWithKey, addLog]);

  /**
   * Pay trading fee - main function
   */
  const payTradingFee = useCallback(async (): Promise<FeePaymentResult> => {
    setIsPayingFee(true);
    setFeeError(null);

    try {
      addLog('info', 'Starting fee payment...');
      
      // Get transaction data from API first
      const txData = await getFeeTransactionData();
      addLog('info', 'Transaction data received', { isBaseAccount: txData.isBaseAccount });

      // If using Base Account SDK, we don't need private key
      if (txData.isBaseAccount && isBaseContext && sdk) {
        addLog('info', 'Using Base Account SDK for fee payment');
        const result = await payFeeWithBaseAccount(txData);
        setFeeError(null);
        addLog('success', 'Fee payment successful via Base Account SDK');
        return result;
      }

      // For trading wallet, we need private key - fetch it on-demand if not loaded
      let walletWithKey = tradingWalletWithKey;
      
      if (!walletWithKey?.privateKey && tradingWallet?.address) {
        addLog('warning', 'Private key not loaded, fetching on-demand...');
        walletWithKey = await fetchWalletWithKeyOnDemand();
      }

      // Update walletForFee with the fetched wallet
      const effectiveWallet = walletWithKey || tradingWallet || primaryWallet;
      
      addLog('info', 'Wallet status check', {
        hasWallet: !!effectiveWallet,
        walletAddress: effectiveWallet?.address ? `${effectiveWallet.address.slice(0, 10)}...` : 'none',
        hasPrivateKey: !!effectiveWallet?.privateKey,
        hasTradingWalletWithKey: !!walletWithKey,
        hasTradingWallet: !!tradingWallet
      });

      // Check if we have any wallet available
      if (!effectiveWallet?.address && !txData.isBaseAccount) {
        addLog('error', 'No wallet available');
        throw new Error('No wallet available. Please connect your wallet first.');
      }

      // Determine payment method
      let result: FeePaymentResult;

      if (txData.isBaseAccount) {
        // Base Account but no SDK context - provide helpful error
        addLog('error', 'Base Account without SDK context');
        throw new Error('Base Account detected but SDK not available. Please open the app inside the Farcaster/Base mini app context.');
      } else if (effectiveWallet?.privateKey) {
        // Use trading wallet with private key for automated trading
        addLog('info', `Using trading wallet with private key for fee payment: ${effectiveWallet.address.slice(0, 10)}...`);
        
        // Pay fee directly with the wallet that has private key
        if (!effectiveWallet.privateKey) {
          throw new Error('Private key not available');
        }
        
        const networkConfig = getNetworkConfig();
        const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
        const wallet = new ethers.Wallet(effectiveWallet.privateKey, provider);
        
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

        result = {
          success: true,
          transactionHash: tx.hash,
          amount: txData.amounts.eth,
          currency: 'ETH',
        };
        addLog('success', `Fee payment successful! TX: ${tx.hash.slice(0, 10)}...`);
      } else {
        // No private key and not a Base Account
        addLog('error', 'No private key available for trading wallet', {
          effectiveWallet: effectiveWallet ? { address: effectiveWallet.address } : null,
          walletWithKey: walletWithKey ? { address: walletWithKey.address, hasKey: !!walletWithKey.privateKey } : null
        });
        throw new Error('Trading wallet private key not available. Please ensure you have deposited funds and your trading wallet is set up correctly.');
      }

      if (!result.success) {
        addLog('error', 'Fee payment failed', result.error);
        setFeeError(result.error || 'Failed to pay fee');
        throw new Error(result.error || 'Failed to pay fee');
      }

      setFeeError(null);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pay trading fee';
      addLog('error', 'Fee payment error', errorMessage);
      setFeeError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsPayingFee(false);
    }
  }, [token, sdk, isBaseContext, tradingWalletWithKey, tradingWallet, primaryWallet, getFeeTransactionData, payFeeWithBaseAccount, fetchWalletWithKeyOnDemand, addLog]);

  return {
    payTradingFee,
    isPayingFee,
    feeError,
  };
}

