"use client";

/**
 * Test Page for Base Mini App
 * Use this page to test all functionality before production
 */

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useBaseMiniApp } from '@/lib/hooks/useBaseMiniApp';
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestPage() {
  const { user, token, isAuthenticated } = useAuth();
  const { isBaseContext, isReady, auth, authenticate } = useBaseMiniApp();
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [walletService] = useState(() => new BaseAccountWalletService());

  const runTest = async (name: string, testFn: () => Promise<any>) => {
    setIsTesting(true);
    try {
      const result = await testFn();
      setTestResults(prev => ({ ...prev, [name]: { success: true, result } }));
      return result;
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [name]: { success: false, error: error instanceof Error ? error.message : String(error) }
      }));
      throw error;
    } finally {
      setIsTesting(false);
    }
  };

  const testBaseContext = async () => {
    await runTest('Base Context', async () => {
      return {
        isBaseContext,
        isReady,
        hasFarcaster: typeof window !== 'undefined' && !!(window as any).farcaster
      };
    });
  };

  const testAuthentication = async () => {
    await runTest('Authentication', async () => {
      if (!isBaseContext) {
        throw new Error('Not in Base context');
      }
      const result = await authenticate();
      return {
        authenticated: !!result,
        fid: result?.fid,
        hasToken: !!result?.token
      };
    });
  };

  const testWalletCreation = async () => {
    await runTest('Wallet Creation', async () => {
      if (!user?.fid) {
        throw new Error('No FID available');
      }
      const wallet = await walletService.getOrCreateWallet(user.fid, 'ethereum');
      return {
        address: wallet?.address,
        hasPrivateKey: !!wallet?.privateKey,
        chain: wallet?.chain
      };
    });
  };

  const testWalletRetrieval = async () => {
    await runTest('Wallet Retrieval', async () => {
      if (!user?.fid) {
        throw new Error('No FID available');
      }
      const wallet = await walletService.getWalletWithKey(user.fid, 'ethereum');
      return {
        found: !!wallet,
        address: wallet?.address,
        hasPrivateKey: !!wallet?.privateKey
      };
    });
  };

  const testAPIEndpoints = async () => {
    await runTest('API Endpoints', async () => {
      if (!token) {
        throw new Error('No token available');
      }

      const tests = {
        status: null as any,
        wallet: null as any,
        positions: null as any,
      };

      // Test status endpoint
      try {
        const statusRes = await fetch('/api/status');
        tests.status = await statusRes.json();
      } catch (e) {
        tests.status = { error: String(e) };
      }

      // Test wallet endpoint
      try {
        const walletRes = await fetch('/api/wallet/primary-with-key', {
          headers: { Authorization: `Bearer ${token}` }
        });
        tests.wallet = await walletRes.json();
      } catch (e) {
        tests.wallet = { error: String(e) };
      }

      // Test positions endpoint
      try {
        const positionsRes = await fetch('/api/positions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        tests.positions = await positionsRes.json();
      } catch (e) {
        tests.positions = { error: String(e) };
      }

      return tests;
    });
  };

  const testFullFlow = async () => {
    setIsTesting(true);
    try {
      await testBaseContext();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (isBaseContext) {
        await testAuthentication();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (isAuthenticated) {
        await testWalletCreation();
        await new Promise(resolve => setTimeout(resolve, 500));
        await testWalletRetrieval();
        await new Promise(resolve => setTimeout(resolve, 500));
        await testAPIEndpoints();
      }

      setTestResults(prev => ({
        ...prev,
        fullFlow: { success: true, message: 'All tests completed' }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        fullFlow: { success: false, error: String(error) }
      }));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">🧪 Base Mini App Test Page</h1>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-[#1a1a1a]">
            <div className="text-sm text-gray-400">Base Context</div>
            <div className="text-xl font-bold">
              {isBaseContext ? '✅ Yes' : '❌ No'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Ready: {isReady ? '✅' : '⏳'}
            </div>
          </Card>

          <Card className="p-4 bg-[#1a1a1a]">
            <div className="text-sm text-gray-400">Authentication</div>
            <div className="text-xl font-bold">
              {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              FID: {user?.fid || 'N/A'}
            </div>
          </Card>

          <Card className="p-4 bg-[#1a1a1a]">
            <div className="text-sm text-gray-400">Token</div>
            <div className="text-xl font-bold">
              {token ? '✅ Available' : '❌ Missing'}
            </div>
            <div className="text-xs text-gray-500 mt-1 truncate">
              {token ? token.substring(0, 20) + '...' : 'No token'}
            </div>
          </Card>
        </div>

        {/* Test Buttons */}
        <Card className="p-6 bg-[#1a1a1a]">
          <h2 className="text-xl font-bold mb-4">Individual Tests</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Button
              onClick={testBaseContext}
              disabled={isTesting}
              className="bg-[#8759ff] hover:bg-[#7c4dff]"
            >
              Test Base Context
            </Button>
            <Button
              onClick={testAuthentication}
              disabled={isTesting || !isBaseContext}
              className="bg-[#8759ff] hover:bg-[#7c4dff]"
            >
              Test Authentication
            </Button>
            <Button
              onClick={testWalletCreation}
              disabled={isTesting || !isAuthenticated}
              className="bg-[#8759ff] hover:bg-[#7c4dff]"
            >
              Test Wallet Creation
            </Button>
            <Button
              onClick={testWalletRetrieval}
              disabled={isTesting || !isAuthenticated}
              className="bg-[#8759ff] hover:bg-[#7c4dff]"
            >
              Test Wallet Retrieval
            </Button>
            <Button
              onClick={testAPIEndpoints}
              disabled={isTesting || !token}
              className="bg-[#8759ff] hover:bg-[#7c4dff]"
            >
              Test API Endpoints
            </Button>
            <Button
              onClick={testFullFlow}
              disabled={isTesting}
              className="bg-green-600 hover:bg-green-700 col-span-2 md:col-span-1"
            >
              🚀 Run All Tests
            </Button>
          </div>
        </Card>

        {/* Test Results */}
        <Card className="p-6 bg-[#1a1a1a]">
          <h2 className="text-xl font-bold mb-4">Test Results</h2>
          <div className="space-y-3">
            {Object.entries(testResults).map(([name, result]) => (
              <div
                key={name}
                className={`p-3 rounded ${
                  result.success ? 'bg-green-900/20' : 'bg-red-900/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{name}</span>
                  <span>{result.success ? '✅' : '❌'}</span>
                </div>
                {result.success ? (
                  <pre className="text-xs mt-2 overflow-auto">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                ) : (
                  <div className="text-red-400 text-sm mt-2">
                    {result.error}
                  </div>
                )}
              </div>
            ))}
            {Object.keys(testResults).length === 0 && (
              <div className="text-gray-500 text-center py-8">
                No tests run yet. Click a test button above to start.
              </div>
            )}
          </div>
        </Card>

        {/* Instructions */}
        <Card className="p-6 bg-[#1a1a1a]">
          <h2 className="text-xl font-bold mb-4">📝 Testing Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            <li>Open this page in Base app context (or Base Build preview)</li>
            <li>Click &quot;Run All Tests&quot; to test everything</li>
            <li>Or test individual components one by one</li>
            <li>Check results below for any failures</li>
            <li>All tests should pass before production deployment</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

