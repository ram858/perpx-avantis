/**
 * Base Account Transaction Signing Service
 * Handles transaction signing via Base Account SDK for Base Account users
 */

import { useBaseMiniApp } from '@/lib/hooks/useBaseMiniApp';

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gas?: string;
  gasPrice?: string;
}

export interface BatchCall {
  to: string;
  value?: string;
  data?: string;
}

export interface SignedTransaction {
  hash: string;
  transaction: TransactionRequest;
}

export class BaseAccountTransactionService {
  private sdk: any; // Base Account SDK instance

  constructor(sdk: any) {
    this.sdk = sdk;
  }

  /**
   * Sign and send a transaction via Base Account SDK
   */
  async signAndSendTransaction(tx: TransactionRequest): Promise<string> {
    // Use recommended method: sdk.wallet.getEthereumProvider()
    // Fallback to sdk.provider for backward compatibility
    let provider: any = null;
    
    if (this.sdk.wallet?.getEthereumProvider) {
      provider = await this.sdk.wallet.getEthereumProvider();
    } else {
      provider = this.sdk.provider;
    }
    
    if (!provider) {
      throw new Error('Base Account SDK provider not available');
    }

    try {
      // Request transaction signature via Base Account SDK
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [tx],
      });

      return hash as string;
    } catch (error) {
      console.error('[BaseAccountTransactionService] Error signing transaction:', error);
      throw new Error(
        `Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sign a transaction without sending (for manual review)
   */
  async signTransaction(tx: TransactionRequest): Promise<SignedTransaction> {
    let provider: any = null;
    
    if (this.sdk.wallet?.getEthereumProvider) {
      provider = await this.sdk.wallet.getEthereumProvider();
    } else {
      provider = this.sdk.provider;
    }
    
    if (!provider) {
      throw new Error('Base Account SDK provider not available');
    }

    try {
      // Sign transaction via Base Account SDK
      const signedTx = await provider.request({
        method: 'eth_signTransaction',
        params: [tx],
      });

      return {
        hash: signedTx.hash,
        transaction: tx,
      };
    } catch (error) {
      console.error('[BaseAccountTransactionService] Error signing transaction:', error);
      throw new Error(
        `Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get Base Account address
   */
  async getAddress(): Promise<string | null> {
    let provider: any = null;
    
    if (this.sdk.wallet?.getEthereumProvider) {
      provider = await this.sdk.wallet.getEthereumProvider();
    } else {
      provider = this.sdk.provider;
    }
    
    if (!provider) {
      return null;
    }

    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      return accounts && accounts.length > 0 ? accounts[0] : null;
    } catch (error) {
      console.error('[BaseAccountTransactionService] Error getting address:', error);
      return null;
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(tx: TransactionRequest): Promise<string> {
    let provider: any = null;
    
    if (this.sdk.wallet?.getEthereumProvider) {
      provider = await this.sdk.wallet.getEthereumProvider();
    } else {
      provider = this.sdk.provider;
    }
    
    if (!provider) {
      throw new Error('Base Account SDK provider not available');
    }

    try {
      const gasEstimate = await provider.request({
        method: 'eth_estimateGas',
        params: [tx],
      });

      return gasEstimate as string;
    } catch (error) {
      console.error('[BaseAccountTransactionService] Error estimating gas:', error);
      throw new Error(
        `Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send batch transactions (EIP-5792 wallet_sendCalls)
   * Allows multiple transactions to be confirmed in a single user action
   * Useful for: approve + swap, multiple operations, etc.
   */
  async sendBatchTransactions(
    calls: BatchCall[],
    chainId: number = 8453 // Base mainnet default
  ): Promise<string> {
    // Use recommended method: sdk.wallet.getEthereumProvider()
    // Fallback to sdk.provider for backward compatibility
    let provider: any = null;
    
    if (this.sdk.wallet?.getEthereumProvider) {
      provider = await this.sdk.wallet.getEthereumProvider();
    } else {
      provider = this.sdk.provider;
    }
    
    if (!provider) {
      throw new Error('Base Account SDK provider not available');
    }

    try {
      // Check if provider supports batch transactions
      
      // Try to send batch transactions via EIP-5792
      try {
        const hash = await provider.request({
          method: 'wallet_sendCalls',
          params: [{
            version: '1.0',
            chainId: `eip155:${chainId}`, // e.g., "eip155:8453" for Base
            calls: calls.map(call => ({
              to: call.to,
              value: call.value || '0x0',
              data: call.data || '0x',
            })),
          }],
        });

        console.log('[BaseAccountTransactionService] Batch transaction sent:', hash);
        return hash as string;
      } catch (batchError) {
        // Fallback: Send transactions individually if batch not supported
        console.warn(
          '[BaseAccountTransactionService] Batch transactions not supported, falling back to individual transactions',
          batchError
        );
        
        // Send transactions sequentially
        const hashes: string[] = [];
        for (const call of calls) {
          const hash = await this.signAndSendTransaction({
            to: call.to,
            value: call.value,
            data: call.data,
          });
          hashes.push(hash);
        }
        
        // Return the last transaction hash
        // Note: In a real implementation, you might want to return all hashes
        return hashes[hashes.length - 1];
      }
    } catch (error) {
      console.error('[BaseAccountTransactionService] Error sending batch transactions:', error);
      throw new Error(
        `Failed to send batch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(hash: string, confirmations: number = 1): Promise<any> {
    let provider: any = null;
    
    if (this.sdk.wallet?.getEthereumProvider) {
      provider = await this.sdk.wallet.getEthereumProvider();
    } else {
      provider = this.sdk.provider;
    }
    
    if (!provider) {
      throw new Error('Base Account SDK provider not available');
    }

    try {
      // Poll for transaction receipt
      let receipt = null;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max wait

      while (!receipt && attempts < maxAttempts) {
        receipt = await provider.request({
          method: 'eth_getTransactionReceipt',
          params: [hash],
        });

        if (!receipt) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          attempts++;
        }
      }

      if (!receipt) {
        throw new Error('Transaction confirmation timeout');
      }

      return receipt;
    } catch (error) {
      console.error('[BaseAccountTransactionService] Error waiting for transaction:', error);
      throw new Error(
        `Failed to confirm transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Hook for using Base Account transaction signing
 */
export function useBaseAccountTransactions() {
  const { sdk, isBaseContext } = useBaseMiniApp();

  const signAndSendTransaction = async (tx: TransactionRequest): Promise<string> => {
    if (!isBaseContext || !sdk) {
      throw new Error('Not in Base mini app context');
    }

    const service = new BaseAccountTransactionService(sdk);
    return service.signAndSendTransaction(tx);
  };

  const signTransaction = async (tx: TransactionRequest): Promise<SignedTransaction> => {
    if (!isBaseContext || !sdk) {
      throw new Error('Not in Base mini app context');
    }

    const service = new BaseAccountTransactionService(sdk);
    return service.signTransaction(tx);
  };

  const getAddress = async (): Promise<string | null> => {
    if (!isBaseContext || !sdk) {
      return null;
    }

    const service = new BaseAccountTransactionService(sdk);
    return service.getAddress();
  };

  const estimateGas = async (tx: TransactionRequest): Promise<string> => {
    if (!isBaseContext || !sdk) {
      throw new Error('Not in Base mini app context');
    }

    const service = new BaseAccountTransactionService(sdk);
    return service.estimateGas(tx);
  };

  const waitForTransaction = async (hash: string, confirmations?: number): Promise<any> => {
    if (!isBaseContext || !sdk) {
      throw new Error('Not in Base mini app context');
    }

    const service = new BaseAccountTransactionService(sdk);
    return service.waitForTransaction(hash, confirmations);
  };

  const sendBatchTransactions = async (
    calls: BatchCall[],
    chainId?: number
  ): Promise<string> => {
    if (!isBaseContext || !sdk) {
      throw new Error('Not in Base mini app context');
    }

    const service = new BaseAccountTransactionService(sdk);
    return service.sendBatchTransactions(calls, chainId);
  };

  return {
    signAndSendTransaction,
    signTransaction,
    getAddress,
    estimateGas,
    waitForTransaction,
    sendBatchTransactions,
    isAvailable: isBaseContext && !!sdk,
  };
}

