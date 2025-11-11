"use client";

import { useEffect, useState, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export interface BaseAccountAuth {
  token: string | null;
  fid: number | null;
  address: string | null; // Base Account address
  isLoading: boolean;
  error: Error | null;
}

export function useBaseMiniApp() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isBaseContext, setIsBaseContext] = useState(false);
  const [contextChecked, setContextChecked] = useState(false);
  const [auth, setAuth] = useState<BaseAccountAuth>({
    token: null,
    fid: null,
    address: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function initializeSDK() {
      if (typeof window === 'undefined') {
        return;
      }

      try {
        // Ensure the SDK context is resolved before using any actions
        let hasContext = false;

        if (sdk?.context) {
          hasContext = await Promise.resolve(sdk.context).then(
            () => true,
            () => false
          );
        }

        // Attempt to detect if we are inside a Farcaster/Base mini app context
        let detectedBaseContext = false;

        if (sdk?.isInMiniApp) {
          detectedBaseContext = await sdk.isInMiniApp().catch(() => false);
        } else if (hasContext) {
          detectedBaseContext = true;
        } else if ((window as any)?.farcaster) {
          // Fallback detection
          detectedBaseContext = true;
        }

        if (mounted && detectedBaseContext) {
          setIsBaseContext(true);
        }

        // Wait for the app to be fully loaded before calling ready()
        if (mounted && detectedBaseContext && sdk?.actions?.ready) {
          await sdk.actions.ready();
        }

        if (mounted) {
          setIsReady(true);
          setError(null);
        }
      } catch (err) {
        const isNotMiniAppError =
          err instanceof Error &&
          /mini app|context/i.test(err.message) &&
          /not/.test(err.message);

        if (mounted) {
          if (!isNotMiniAppError) {
            setError(err instanceof Error ? err : new Error('Failed to initialize Base Mini App SDK'));
          } else {
            setError(null);
          }
          setIsBaseContext(false);
          setIsReady(true);
        }
      }
      if (mounted) {
        setContextChecked(true);
      }
    }

    initializeSDK();

    return () => {
      mounted = false;
    };
  }, []);

  // Get Base Account address from provider
  const getBaseAccountAddress = useCallback(async (): Promise<string | null> => {
    if (!contextChecked || !isBaseContext) {
      return null;
    }

    try {
      // Get the provider from Base Account SDK
      // Type assertion needed as SDK types may not include provider
      const provider = (sdk as any)?.provider;
      if (!provider) {
        return null;
      }
      
      // Get accounts from provider (Base Account address)
      const accounts = await provider.request({ method: 'eth_accounts' });
      
      if (accounts && accounts.length > 0) {
        return accounts[0]; // Base Account address
      }

      // Alternative: Request account access
      const requestedAccounts = await provider.request({ method: 'eth_requestAccounts' });
      if (requestedAccounts && requestedAccounts.length > 0) {
        return requestedAccounts[0];
      }

      return null;
    } catch (error) {
      console.error('[useBaseMiniApp] Error getting Base Account address:', error);
      return null;
    }
  }, [contextChecked, isBaseContext]);

  // Authenticate with Base Account (Quick Auth)
  const authenticate = useCallback(async () => {
    if (!contextChecked || !isBaseContext || !sdk?.quickAuth) {
      return null;
    }

    setAuth(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get JWT token from Base Account
      const { token } = await sdk.quickAuth.getToken();
      
      // Get Base Account address
      const address = await getBaseAccountAddress();
      
      // Verify token with backend to get user FID and internal JWT
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await sdk.quickAuth.fetch(`${baseUrl}/api/auth/base-account`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to verify Base Account token');
      }

      const data = await response.json();
      
      // Store the internal JWT token (for API calls) along with Base Account token and address
      setAuth({
        token: data.token || token, // Use internal JWT for API calls
        fid: data.fid,
        address: address || data.address || null, // Base Account address
        isLoading: false,
        error: null,
      });

      return { 
        token: data.token || token, 
        fid: data.fid,
        address: address || data.address || null
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Base Account authentication failed');
      setAuth(prev => ({
        ...prev,
        isLoading: false,
        error,
      }));
      return null;
    }
  }, [contextChecked, isBaseContext, getBaseAccountAddress]);

  return {
    isReady,
    error,
    sdk: isReady ? sdk : null,
    isBaseContext,
    auth,
    authenticate,
    getBaseAccountAddress,
  };
}

