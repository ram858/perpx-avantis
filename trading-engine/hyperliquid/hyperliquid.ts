import * as hl from "@nktkas/hyperliquid";
import dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import Decimal from "decimal.js";
import { fetchOHLCVWithFallback, getCachedOHLCV } from "./binanceHistorical";
import { evaluateSignalOnly } from "./strategyEngine";
import { recordAIPOS, getAIPOS } from "./aiStorage";
import { resolveToHLName, resolveToBinancePair } from './symbols/symbolResolver';
import { guessMarketRegime, Regime } from "./regime";
import { winRateTracker } from "./winRateTracker";

// Helper function to record trade in win rate tracker
async function recordTradeInWinRateTracker(symbol: string, exitPrice: number, size: string, reason: string) {
  try {
    const stored = getAIPOS(symbol);
    const positionSize = parseFloat(size);
    
    if (stored && exitPrice > 0) {
      const entryPrice = stored.entryPrice;
      
      // Determine side from stored data first, then fallback to position size
      const side: 'LONG' | 'SHORT' = stored.side || (positionSize > 0 ? 'LONG' : 'SHORT');
      console.log(`🔍 [SIDE_DETERMINATION] ${symbol}: Using stored side ${side} (stored: ${stored.side}, size-based: ${positionSize > 0 ? 'LONG' : 'SHORT'})`);
      
      // Calculate PnL correctly based on position direction
      const pnl = side === 'LONG' ? 
        (exitPrice - entryPrice) * Math.abs(positionSize) : 
        (entryPrice - exitPrice) * Math.abs(positionSize);
      
      // Debug PnL calculation
      console.log(`🔍 [PNL_DEBUG] ${symbol}: Entry=$${entryPrice}, Exit=$${exitPrice}, Size=${Math.abs(positionSize)}, Direction=${side}, PnL=$${pnl.toFixed(2)}`);
      
      // Record the trade based on PnL
      if (reason.includes('liquidated')) {
        console.log(`💥 [WIN_RATE] Recording LIQUIDATION for ${symbol} with PnL $${pnl.toFixed(2)}`);
        winRateTracker.recordTradeLiquidated(symbol, exitPrice, pnl);
      } else if (pnl > 0) {
        console.log(`✅ [WIN_RATE] Recording WIN for ${symbol} with PnL $${pnl.toFixed(2)}`);
        winRateTracker.recordTradeWin(symbol, exitPrice, pnl, reason);
      } else {
        console.log(`❌ [WIN_RATE] Recording LOSS for ${symbol} with PnL $${pnl.toFixed(2)}`);
        winRateTracker.recordTradeLoss(symbol, exitPrice, pnl, reason);
      }
    } else {
      // Fallback: Try to get entry data from win rate tracker if available
      const openTrade = winRateTracker.getOpenTrade(symbol);
      if (openTrade && exitPrice > 0) {
        console.log(`🔄 [WIN_RATE] Using fallback entry data for ${symbol} from win rate tracker`);
        const entryPrice = openTrade.entryPrice;
        const side = openTrade.side;
        
        // Calculate PnL using fallback data
        const pnl = side === 'LONG' ? 
          (exitPrice - entryPrice) * Math.abs(positionSize) : 
          (entryPrice - exitPrice) * Math.abs(positionSize);
        
        console.log(`🔍 [PNL_DEBUG_FALLBACK] ${symbol}: Entry=$${entryPrice}, Exit=$${exitPrice}, Size=${Math.abs(positionSize)}, Direction=${side}, PnL=$${pnl.toFixed(2)}`);
        
        // Record the trade
        if (reason.includes('liquidated')) {
          winRateTracker.recordTradeLiquidated(symbol, exitPrice, pnl);
        } else if (pnl > 0) {
          winRateTracker.recordTradeWin(symbol, exitPrice, pnl, reason);
        } else {
          winRateTracker.recordTradeLoss(symbol, exitPrice, pnl, reason);
        }
      } else {
        console.warn(`⚠️ Cannot record trade for ${symbol} - missing entry data in both AI storage and win rate tracker`);
        console.warn(`   Stored data: ${stored ? 'found' : 'not found'}`);
        console.warn(`   Open trade: ${openTrade ? 'found' : 'not found'}`);
        console.warn(`   Exit price: ${exitPrice}`);
        console.warn(`   Position size: ${size}`);
      }
    }
  } catch (trackerError) {
    console.warn(`⚠️ Failed to record trade result for ${symbol}:`, trackerError);
  }
}

dotenv.config();

// 🔐 Load private key and init account (lazy initialization)
// Priority: Environment variable (from API server) > .env file
let _account: any = null;

function getAccount() {
  const rawKey = process.env.HYPERLIQUID_PK;
  console.log(`[HYPERLIQUID_BOT] 🔑 Using private key: ${rawKey ? rawKey.substring(0, 10) + '...' + rawKey.substring(rawKey.length - 4) : 'null'}`);
  console.log(`[HYPERLIQUID_BOT] 🔑 Key source: ${process.env.HYPERLIQUID_PK ? 'Environment variable' : 'Not found'}`);

  if (!rawKey) {
    console.error('❌ Missing required environment variable: HYPERLIQUID_PK');
    console.error('💡 The bot requires a Hyperliquid private key to be provided by the API server');
    console.error('   (Your private key must start with 0x)');
    throw new Error('HYPERLIQUID_PK not set');
  }

  if (!rawKey.startsWith("0x")) {
    console.error('❌ Invalid private key format. Private key must start with 0x');
    console.error('💡 Example: HYPERLIQUID_PK=0x1234567890abcdef...');
    throw new Error('Invalid private key format');
  }

  if (!_account) {
    _account = privateKeyToAccount(rawKey as `0x${string}`);
    console.log(`🔑 Initialized with Wallet: ${_account.address}`);
  }
  
  return _account;
}

export const account = {
  get address() {
    return getAccount().address;
  },
  signMessage: (message: any) => getAccount().signMessage(message),
  signTypedData: (typedData: any) => getAccount().signTypedData(typedData)
};


// 🌐 Use testnet or mainnet transport based on environment
const isTestnet = process.env.HYPERLIQUID_TESTNET !== 'false'; // Default to testnet unless explicitly set to false
export const transport = new hl.HttpTransport({ isTestnet });
export const publicClient = new hl.PublicClient({ transport });

console.log(`🌐 Using ${isTestnet ? 'TESTNET' : 'MAINNET'} environment`);

// 🌐 Test network connectivity
async function testNetworkConnectivity() {
  const testUrl = isTestnet ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz';
  try {
    console.log(`🌐 Testing connectivity to ${isTestnet ? 'testnet' : 'mainnet'} API...`);
    const response = await fetch(testUrl, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    console.log(`✅ Network connectivity test passed (Status: ${response.status})`);
    return true;
  } catch (error: any) {
    console.error(`❌ Network connectivity test failed: ${error.message}`);
    if (error.code === 'ENOTFOUND') {
      console.error(`   DNS resolution failed for ${testUrl}`);
      console.error(`   Please check your internet connection and DNS settings`);
    }
    return false;
  }
}

// ✅ Singleton WalletClient with proper config
let _walletClient: hl.WalletClient | null = null;
export function getWalletClient(): hl.WalletClient {
  if (!_walletClient) {
    const walletAccount = getAccount(); // This will initialize the account if needed
    _walletClient = new hl.WalletClient({
      wallet: walletAccount,
      transport,
      isTestnet,
      signatureChainId: isTestnet ? "0xa4b1" : "0xa", // Testnet: 0xa4b1, Mainnet: 0xa
    });
    console.log(`🔐 WalletClient instantiated: ${walletAccount.address} (${isTestnet ? 'TESTNET' : 'MAINNET'})`);
  }
  return _walletClient;
}

// 🔁 Retry wrapper for flaky endpoints
async function retry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const body = e?.responseBody || e?.message || '';
      const isHtml = typeof body === 'string' && body.includes('<html');
      const is502 = e?.response?.status === 502 || body.includes("502 Bad Gateway");
      
      // Handle network connectivity issues
      const isNetworkError = e?.code === 'EPIPE' || 
                            e?.code === 'ECONNRESET' || 
                            e?.code === 'ENOTFOUND' ||
                            e?.code === 'ETIMEDOUT' ||
                            e?.syscall === 'write' ||
                            e?.cause?.code === 'EPIPE';

      // Special handling for DNS resolution errors
      if (e?.code === 'ENOTFOUND') {
        console.error(`🌐 DNS Resolution Failed: Cannot resolve ${isTestnet ? 'testnet' : 'mainnet'} API endpoint`);
        console.error(`   This could be due to:`);
        console.error(`   1. Network connectivity issues`);
        console.error(`   2. DNS server problems`);
        console.error(`   3. API endpoint is down`);
        console.error(`   4. Firewall blocking the connection`);
        
        if (i < retries - 1) {
          const delay = 5000; // Longer delay for DNS issues
          console.warn(`🔄 Retrying in ${delay/1000}s... (attempt ${i + 1}/${retries})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }

      if ((is502 || isHtml || isNetworkError) && i < retries - 1) {
        const delay = isNetworkError ? 3000 : 2000; // Longer delay for network errors
        console.warn(`🌐 Hyperliquid ${isNetworkError ? 'network' : '502'} error, retrying in ${delay/1000}s... (attempt ${i + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
  throw new Error("Max retries reached");
}

// Parse order status and track fill information
function parseOrderStatus(status: any, requestedSize: number): OrderStatus {
  // Handle different possible status structures
  let oid = "n/a";
  let isFilled = false;
  let isError = false;
  let errorMsg = "";
  let filledSize = 0;
  let avgFillPrice = 0;
  
  // Check if status is a string (error message)
  if (typeof status === 'string') {
    return {
      oid,
      filled: false,
      filledSize: 0,
      requestedSize,
      fillPercentage: 0,
      error: status
    };
  }
  
  // Check if status is an object with expected properties
  if (status && typeof status === 'object') {
    // Try to extract oid from various possible locations
    if (status.resting && status.resting.oid) {
      oid = status.resting.oid.toString();
    } else if (status.filled && status.filled.oid) {
      oid = status.filled.oid.toString();
    } else if (status.oid) {
      oid = status.oid.toString();
    }
    
    // Check for error
    if (status.error) {
      isError = true;
      errorMsg = status.error;
    }
    
    // Check for filled status
    if (status.filled) {
      isFilled = true;
      filledSize = Math.abs(parseFloat(status.filled.sz || "0"));
      avgFillPrice = parseFloat(status.filled.px || "0");
      

    }
    
    // Check for resting status
    if (status.resting) {
      isFilled = false;
    }
  }
  
  if (isError) {
    return {
      oid,
      filled: false,
      filledSize: 0,
      requestedSize,
      fillPercentage: 0,
      error: errorMsg
    };
  }
  
  if (isFilled) {
    const fillPercentage = requestedSize > 0 ? (filledSize / requestedSize) * 100 : 0;
    return {
      oid,
      filled: true,
      filledSize,
      requestedSize,
      fillPercentage,
      avgFillPrice
    };
  }
  
  // Default to resting status (not an error)
  return {
    oid,
    filled: false,
    filledSize: 0,
    requestedSize,
    fillPercentage: 0
  };
}

// Wait for order to be filled and track status
async function waitForOrderFill(orderId: string, maxWaitTime = 30000): Promise<OrderResult> {
  const startTime = Date.now();
  const checkInterval = 2000; // Check every 2 seconds
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Get order status from Hyperliquid
      const orderStatus = await retry(() => publicClient.orderStatus({ oid: parseInt(orderId), user: account.address }));
      
      if (orderStatus && orderStatus.status) {
        const status = parseOrderStatus(orderStatus.status, 0); // We'll get the requested size from the original order
        
        if (status.filled) {
          console.log(`✅ Order ${orderId} fully filled: ${status.fillPercentage.toFixed(2)}%`);
          return {
            success: true,
            orderId,
            filledSize: status.filledSize,
            requestedSize: status.requestedSize,
            fillPercentage: status.fillPercentage,
            avgFillPrice: status.avgFillPrice,
            status
          };
        } else if (status.error) {
          console.log(`❌ Order ${orderId} failed: ${status.error}`);
          return {
            success: false,
            orderId,
            filledSize: 0,
            requestedSize: status.requestedSize,
            fillPercentage: 0,
            error: status.error,
            status
          };
        }
      }
      
      console.log(`⏳ Order ${orderId} still pending...`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
    } catch (error) {
      console.warn(`⚠️ Error checking order status for ${orderId}:`, error);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  console.warn(`⏰ Order ${orderId} timed out after ${maxWaitTime/1000}s`);
  return {
    success: false,
    orderId,
    filledSize: 0,
    requestedSize: 0,
    fillPercentage: 0,
    error: "Order timeout",
    status: {
      oid: orderId,
      filled: false,
      filledSize: 0,
      requestedSize: 0,
      fillPercentage: 0,
      error: "Order timeout"
    }
  };
}

export async function fetchPrice(symbol: string): Promise<number> {
  if (!symbol) return 0;
  try {
    const hlSymbol = resolveToHLName(symbol);
    const book = await retry(() => publicClient.l2Book({ coin: hlSymbol }));
    const bestBid = parseFloat(book.levels?.[0]?.[0]?.px ?? "0");
    const bestAsk = parseFloat(book.levels?.[1]?.[0]?.px ?? "0");
    
    if (bestBid === 0 || bestAsk === 0) {
      console.warn(`⚠️ Invalid price data for ${symbol}: bid=${bestBid}, ask=${bestAsk}`);
      return 0;
    }
    
    return (bestBid + bestAsk) / 2;
  } catch (err: any) {
    console.error(`❌ Failed to fetch l2Book for ${symbol}:`, err?.responseBody || err);
    return 0;
  }
}

export async function getPositions(): Promise<any[]> {
  try {
    const state = await retry(() => publicClient.clearinghouseState({ user: account.address }));
    return (state?.assetPositions ?? []).map(p => {
      // Determine side from position size - negative size = short, positive size = long
      const size = parseFloat(p?.position?.szi ?? "0");
      const side = size > 0 ? "long" : size < 0 ? "short" : "unknown";
      
      return {
        ...p,
        coin: p?.position?.coin,
        side: side,
        entryPx: p?.position?.entryPx,
        szi: p?.position?.szi
      };
    });
  } catch (err: any) {
    console.error("❌ Failed to fetch positions:", err?.responseBody || err);
    return [];
  }
}

// You can move this TIF type to types.ts if reused
type TIF = "Gtc" | "Ioc";

// Order tracking interfaces
interface OrderStatus {
  oid: string;
  filled: boolean;
  filledSize: number;
  requestedSize: number;
  fillPercentage: number;
  avgFillPrice?: number;
  error?: string;
}

interface OrderResult {
  success: boolean;
  orderId: string;
  filledSize: number;
  requestedSize: number;
  fillPercentage: number;
  avgFillPrice?: number;
  error?: string;
  status: OrderStatus;
}

export async function closePosition(symbol: string, pos: any, reason: string, price: number | undefined) {
  try {
    const meta = await retry(() => publicClient.meta());
    const hlSymbol = resolveToHLName(symbol);
    const assetIndex = meta.universe.findIndex((a) => a.name === hlSymbol);
    if (assetIndex === -1) throw new Error(`Unknown asset ${symbol}`);

    // Resolve side - handle different position data structures
    let sideResolved = null;
    
    // Try multiple possible side locations
    const possibleSides = [
      pos?.side?.toLowerCase?.(),
      pos?.position?.side?.toLowerCase?.(),
      pos?.coin?.toLowerCase?.() === symbol.toLowerCase() ? pos?.side?.toLowerCase?.() : null
    ];
    
    for (const side of possibleSides) {
      if (["long", "short"].includes(side)) {
        sideResolved = side;
        break;
      }
    }

    // If still can't determine side, try to infer from position size
    if (!sideResolved) {
      const sizeRaw = pos?.position?.szi ?? pos?.szi ?? "0";
      const sizeParsed = parseFloat(sizeRaw);
      if (sizeParsed > 0) {
        sideResolved = "long";
      } else if (sizeParsed < 0) {
        sideResolved = "short";
      } else {
        // Security: Remove debug logging in production
        sideResolved = "short";
      }
    }

    const isBuy = sideResolved === "short";

    // Resolve and validate size
    const sizeRaw = pos?.position?.szi ?? pos?.szi ?? "0";
    const sizeParsed = parseFloat(sizeRaw);
    const sizeAbs = Math.abs(sizeParsed);
    const size = sizeAbs.toFixed(6); // high precision, avoids scientific notation

    if (!sizeAbs || sizeAbs <= 0) {
      throw new Error(`Invalid position size for ${symbol}: ${sizeRaw}`);
    }

    // Validate price
    if (price === undefined || price === null || isNaN(price)) {
      throw new Error(`❌ Invalid price passed to closePosition for ${symbol}: ${price}`);
    }

    // Format price with proper tick size based on Hyperliquid requirements
    // Hyperliquid uses different tick sizes based on asset price ranges
    let priceStr;
    if (price >= 1000) {
      // For high-value assets like BTC, ETH, MKR - tick size is 0.1
      priceStr = Math.round(price * 10) / 10;
    } else if (price >= 100) {
      // For medium-value assets - tick size is 0.01
      priceStr = Math.round(price * 100) / 100;
    } else if (price >= 10) {
      // For lower-value assets - tick size is 0.001
      priceStr = Math.round(price * 1000) / 1000;
    } else if (price >= 1) {
      // For assets between 1-10 - tick size is 0.0001
      priceStr = Math.round(price * 10000) / 10000;
    } else {
      // For very low-value assets - tick size is 0.00001
      priceStr = Math.round(price * 100000) / 100000;
    }
    
    // Convert to string with appropriate decimal places
    priceStr = priceStr.toString();
    
    // Market order closing strategy
    let closeResult: OrderResult | null = null;
    const requestedCloseSize = parseFloat(size);
    
    try {
      // Temporary debug logging to fix close position issue
      console.log(`🔧 [DEBUG] Attempting to close ${symbol}:`);
      console.log(`  - Side: ${sideResolved} (isBuy: ${isBuy})`);
      console.log(`  - Size: ${size} (abs: ${sizeAbs})`);
      console.log(`  - Price: ${price}`);
      console.log(`  - Asset Index: ${assetIndex}`);
      
      console.log(`📈 Executing market order close for ${symbol} (${isBuy ? 'BUY' : 'SELL'})`);
      
      // Use more aggressive limit order to ensure execution
      // Dynamic decimal places based on price magnitude
      const getDecimalPlaces = (price: number) => {
        if (price >= 1000) return 1; // For high-priced tokens like MKR, BTC
        if (price >= 100) return 2;  // For medium-priced tokens
        if (price >= 10) return 3;   // For lower-priced tokens
        return 4; // Default for very low-priced tokens
      };
      
      const decimalPlaces = getDecimalPlaces(price);
      // Use more aggressive pricing to ensure execution
      const aggressiveClosePrice = isBuy ? 
        (price * 1.02).toFixed(decimalPlaces) : // 2% above for buy (closing short)
        (price * 0.98).toFixed(decimalPlaces);  // 2% below for sell (closing long)
      
      console.log(`🔧 Closing ${symbol} - Price: $${price}, Decimal Places: ${decimalPlaces}, Aggressive Price: $${aggressiveClosePrice}`);
      
      const marketOrder = {
        orders: [
          {
            a: assetIndex,
            b: isBuy,
            p: aggressiveClosePrice,
            s: size,
            r: true, // Reduce-only for closing
            t: { limit: { tif: "Ioc" as TIF } }, // Use IOC for immediate execution
          },
        ],
        grouping: "na" as const,
      };

      console.log(`🔧 [DEBUG] Sending order to Hyperliquid:`, JSON.stringify(marketOrder, null, 2));
      
      const marketRes = await retry(() => getWalletClient().order(marketOrder));
      console.log(`🔧 [DEBUG] Order response:`, JSON.stringify(marketRes, null, 2));
      
      const st = marketRes.response.data.statuses[0];
      const orderStatus = parseOrderStatus(st, requestedCloseSize);
      
      console.log(`🔧 [DEBUG] Parsed order status:`, orderStatus);
      
      if (orderStatus.error) {
        console.error(`❌ Market order close failed: ${orderStatus.error}`);
      } else if (orderStatus.filled) {
        console.log(`✅ Closed ${symbol} @ $${orderStatus.avgFillPrice} | TX: ${orderStatus.oid} | Fill: ${orderStatus.fillPercentage.toFixed(2)}% | Reason: ${reason}`);
        closeResult = {
          success: true,
          orderId: orderStatus.oid,
          filledSize: orderStatus.filledSize,
          requestedSize: orderStatus.requestedSize,
          fillPercentage: orderStatus.fillPercentage,
          avgFillPrice: orderStatus.avgFillPrice,
          status: orderStatus
        };
      } else {
        // If order didn't fill, try with current market price as fallback
        console.log(`⚠️ Aggressive order didn't fill, trying with current market price...`);
        const fallbackOrder = {
          orders: [
            {
              a: assetIndex,
              b: isBuy,
              p: price.toFixed(decimalPlaces), // Use current market price
              s: size,
              r: true, // Reduce-only for closing
              t: { limit: { tif: "Ioc" as TIF } }, // Use IOC for immediate execution
            },
          ],
          grouping: "na" as const,
        };

        try {
          const fallbackRes = await retry(() => getWalletClient().order(fallbackOrder));
          const fallbackSt = fallbackRes.response.data.statuses[0];
          const fallbackOrderStatus = parseOrderStatus(fallbackSt, requestedCloseSize);
          
          if (fallbackOrderStatus.filled) {
            console.log(`✅ Closed ${symbol} @ $${fallbackOrderStatus.avgFillPrice} (fallback) | TX: ${fallbackOrderStatus.oid} | Fill: ${fallbackOrderStatus.fillPercentage.toFixed(2)}% | Reason: ${reason}`);
            closeResult = {
              success: true,
              orderId: fallbackOrderStatus.oid,
              filledSize: fallbackOrderStatus.filledSize,
              requestedSize: fallbackOrderStatus.requestedSize,
              fillPercentage: fallbackOrderStatus.fillPercentage,
              avgFillPrice: fallbackOrderStatus.avgFillPrice,
              status: fallbackOrderStatus
            };
          } else {
            console.warn(`⚠️ Fallback order also didn't fill for ${symbol}`);
          }
        } catch (fallbackErr: any) {
          console.error(`❌ Fallback order failed: ${fallbackErr?.message ?? fallbackErr}`);
        }
      }
    } catch (marketErr: any) {
      console.error(`❌ Market order close failed: ${marketErr?.message ?? marketErr}`);
    }

    // Log final result and record trade
    if (closeResult && closeResult.success && closeResult.fillPercentage > 0) {
      console.log(`✅ Successfully closed ${symbol}: ${closeResult.fillPercentage.toFixed(2)}% filled @ $${closeResult.avgFillPrice}`);
      
      // Record trade result in win rate tracker with actual fill price
      if (closeResult.avgFillPrice !== undefined && closeResult.avgFillPrice > 0) {
        await recordTradeInWinRateTracker(symbol, closeResult.avgFillPrice, sizeParsed.toString(), reason);
      } else {
        console.warn(`⚠️ Cannot record trade for ${symbol} - invalid fill price: ${closeResult.avgFillPrice}`);
      }
    } else {
      console.warn(`⚠️ Failed to close ${symbol} - order did not fill (${closeResult?.fillPercentage?.toFixed(2) || '0'}% filled)`);
      
      // For profit goal or session end, record trade with current market price even if order didn't fill
      if (reason.includes('profit_goal') || reason.includes('session_end')) {
        console.log(`📝 Recording trade for ${symbol} with current market price due to ${reason}`);
        await recordTradeInWinRateTracker(symbol, price, sizeParsed.toString(), reason);
      }
    }
  } catch (err) {
    // Security: Remove error logging in production
  }
}

export async function closeAllPositions() {
  try {
    console.log(`🔧 [DEBUG] Starting closeAllPositions...`);
    const positions = await getPositions();
    
    console.log(`🔧 [DEBUG] Found ${positions?.length || 0} positions`);
    
    if (!positions || positions.length === 0) {
      console.log(`🔧 [DEBUG] No positions to close`);
      return {
        success: true,
        message: 'No positions to close',
        closedCount: 0
      };
    }
    
    let closedCount = 0;
    let errorCount = 0;
    
    // Log all positions found
    positions.forEach((pos, index) => {
      const coin = pos.coin || pos.position?.coin;
      const szi = pos.szi || pos.position?.szi;
      console.log(`🔧 [DEBUG] Position ${index + 1}: ${coin} - Size: ${szi} - Side: ${pos.side}`);
    });
    
    // Close positions with retry logic
    for (const pos of positions) {
      // Handle different position data structures
      const coin = pos.coin || pos.position?.coin;
      const szi = pos.szi || pos.position?.szi;
      
      if (!coin || !szi) {
        console.log(`🔧 [DEBUG] Skipping invalid position: coin=${coin}, szi=${szi}`);
        continue; // Skip invalid positions
      }
      
      const size = Math.abs(parseFloat(szi));
      
      console.log(`🔧 [DEBUG] Processing position: ${coin} with size ${size}`);
      console.log(`🔧 [DEBUG] Position data:`, { coin, szi, side: pos.side });
      
      if (size < 0.001) {
        console.log(`🔧 [DEBUG] Skipping very small position: ${coin} (${size})`);
        continue; // Skip very small positions
      }
      
      try {
        const price = await fetchPrice(coin);
        console.log(`🔧 [DEBUG] Fetched price for ${coin}: ${price}`);
        
        if (price && price > 0) {
          console.log(`🔧 [DEBUG] Calling closePosition for ${coin}...`);
          // Pass the position object as-is to closePosition
          await closePosition(coin, pos, "session_end", price);
          console.log(`🔧 [DEBUG] closePosition completed for ${coin}`);
          closedCount++;
          
          // Add small delay between closes to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log(`🔧 [DEBUG] Invalid price for ${coin}: ${price}`);
          errorCount++;
        }
      } catch (error) {
        console.log(`🔧 [DEBUG] Error closing ${coin}:`, error);
        errorCount++;
        // Continue with other positions even if one fails
      }
    }
    
    console.log(`🔧 [DEBUG] closeAllPositions completed - Closed: ${closedCount}, Errors: ${errorCount}`);
    // Log final statistics
    winRateTracker.logStats();
    
    return {
      success: true,
      message: `Successfully closed ${closedCount} positions`,
      closedCount,
      errorCount,
      totalPositions: positions.length
    };
  } catch (error) {
    console.log(`🔧 [DEBUG] Error in closeAllPositions:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      closedCount: 0,
      errorCount: 0,
      totalPositions: 0
    };
  }
}

export async function getTotalPnL(): Promise<number> {
  try {
    const positions = await getPositions();
    let total = 0;

    for (const pos of positions) {
      const entry = Number(pos.entryPx ?? 0); // Don't divide by 1e10, use as is
      const size = Number(pos.szi ?? 0);
      if (!entry || !size) continue;
      
      const mark = await fetchPrice(pos.coin);
      if (mark === 0 || mark === null || mark === undefined || isNaN(mark)) {
        console.warn(`⚠️ Skipping PnL calculation for ${pos.coin} - invalid price: ${mark}`);
        continue;
      }
      
      // Determine direction based on position size (positive = long, negative = short)
      const dir = size > 0 ? 1 : -1;
      const value = Math.abs(size) * entry; // USD position size
      const pnl = value * ((mark - entry) / entry) * dir; // Correct PnL formula

      console.log(`📈 ${pos.coin} | ${pos.side} | Entry=$${entry} | Mark=$${mark} | PnL=$${pnl.toFixed(2)}`);
      total += pnl;
    }

    return total;
  } catch (err: any) {
    console.error("❌ Failed to calculate PnL:", err?.responseBody || err);
    return 0;
  }
}

// Helper function to manually record liquidated trades
export async function recordLiquidatedTrades(): Promise<void> {
  try {
    const positions = await getPositions();
    console.log(`🔍 [LIQUIDATION_DEBUG] Checking ${positions.length} positions for liquidation recording`);
    
    for (const pos of positions) {
      const entry = Number(pos.entryPx ?? 0);
      const size = Number(pos.szi ?? 0);
      
      if (!entry || !size) {
        console.log(`⚠️ [LIQUIDATION_DEBUG] Skipping ${pos.coin} - invalid entry or size`);
        continue;
      }
      
      const mark = await fetchPrice(pos.coin);
      if (!mark || mark <= 0) {
        console.log(`⚠️ [LIQUIDATION_DEBUG] Skipping ${pos.coin} - invalid mark price`);
        continue;
      }
      
      // Check if this trade is already recorded
      const openTrade = winRateTracker.getOpenTrade(pos.coin);
      if (!openTrade) {
        console.log(`⚠️ [LIQUIDATION_DEBUG] No open trade found for ${pos.coin} - may have been already closed`);
        continue;
      }
      
      // Calculate PnL
      const dir = size > 0 ? 1 : -1;
      const value = Math.abs(size) * entry;
      const pnl = value * ((mark - entry) / entry) * dir;
      
      console.log(`💥 [LIQUIDATION_DEBUG] Recording liquidation for ${pos.coin}: Entry=$${entry}, Mark=$${mark}, PnL=$${pnl.toFixed(2)}`);
      winRateTracker.recordTradeLiquidated(pos.coin, mark, pnl);
    }
  } catch (err: any) {
    console.error("❌ Failed to record liquidated trades:", err);
  }
}

// Helper function to record existing positions as trades when bot starts
export async function recordExistingPositionsAsTrades(): Promise<void> {
  try {
    const positions = await getPositions();
    console.log(`🔍 [EXISTING_POSITIONS] Found ${positions.length} existing positions to record as trades`);
    
    for (const pos of positions) {
      const entry = Number(pos.entryPx ?? 0);
      const size = Number(pos.szi ?? 0);
      
      if (!entry || !size) {
        console.log(`⚠️ [EXISTING_POSITIONS] Skipping ${pos.coin} - invalid entry or size`);
        continue;
      }
      
      // Check if this trade is already recorded
      const existingTrade = winRateTracker.getOpenTrade(pos.coin);
      if (existingTrade) {
        console.log(`⚠️ [EXISTING_POSITIONS] Trade already recorded for ${pos.coin}`);
        continue;
      }
      
      // Determine side from position size
      const side: 'LONG' | 'SHORT' = size > 0 ? 'LONG' : 'SHORT';
      
      console.log(`📝 [EXISTING_POSITIONS] Recording existing position as trade: ${pos.coin} ${side} @ $${entry}`);
      winRateTracker.recordTradeOpen(pos.coin, entry, Math.abs(size), side);
    }
  } catch (err: any) {
    console.error("❌ Failed to record existing positions as trades:", err);
  }
}

export async function runSignalCheckAndOpen({
  symbol,
  perPositionBudget,
  regimeOverride,
  leverage
}: {
  symbol: string;
  perPositionBudget: number;
  regimeOverride?: string;
  leverage: number;
}): Promise<{
  signalScore: number;
  positionOpened: boolean;
  marketRegime: string;
  reason: string;
}> {
  const ohlcv4h = await getCachedOHLCV(symbol, "4h", 300);
  const ohlcv6h = await getCachedOHLCV(symbol, "6h", 300);
  const entryPrice = ohlcv4h.close.at(-1);
  if (!ohlcv6h || ohlcv6h.close.length < 100 || !entryPrice || entryPrice <= 0) {
    return { positionOpened: false, marketRegime: "unknown", reason: "invalid_ohlcv_or_price", signalScore: 0 };
  }

  const { regime: guessedRegime, confidence: regimeConfidence } =
    regimeOverride ? { regime: regimeOverride, confidence: 1.0 } : await guessMarketRegime(symbol, ohlcv4h, ohlcv6h);

  console.log(`🧠 Regime detected for ${symbol}: ${guessedRegime} (${(regimeConfidence * 100).toFixed(1)}%)`);

  const result = await evaluateSignalOnly(symbol, ohlcv4h, {
    regimeOverride: guessedRegime as Regime,
    leverage,
    bypassBacktestCheck: true
  });

  const {
    direction,
    tp = 0,
    sl = 0,
    signalScore = 0,
    rsiValue: rsi = 0,
    macdHist = 0,
    macdHistPrev = 0,
    emaFast,
    emaSlow,
    atrValue: atr = 0,
    adxValue: adx = 0,
    adxPrev = 0,
    volumePct = 1,
    divergenceScore = 0,
    rrr,
    triggeredBy,
    reason: entryReason,
    passed
  } = result;

  if (!direction || !passed) {
    return {
      positionOpened: false,
      marketRegime: guessedRegime,
      reason: result.reason ?? "invalid_direction_or_not_passed",
      signalScore
    };
  }

  const emaSlope = (emaFast - emaSlow) / (emaSlow || 1);
  const atrPct = atr / (entryPrice || 1);
  const adxSlope = adx - adxPrev;

  console.log(
    `📊 [Signal] ${symbol} | ${direction.toUpperCase()} | Score=${signalScore.toFixed(2)} | RSI=${rsi.toFixed(2)} | MACD=${macdHist.toFixed(4)} | EMA Slope=${emaSlope.toFixed(4)} | ATR=${(atrPct * 100).toFixed(2)}% | ADX=${adx.toFixed(2)} | Vol=${volumePct.toFixed(2)} | ADX Slope=${adxSlope.toFixed(2)} | Lev=${leverage}x | RRR=${rrr?.toFixed(2)}`
  );

  const isLong = direction === "long";
  const safeBudget = new Decimal(perPositionBudget);
  

  
  // Use maximum leverage for maximum position size
  const maxLeverage = leverage;
  const notional = safeBudget.times(maxLeverage);
  const rawQty = notional.div(entryPrice);

  const meta = await publicClient.meta();
  const hlSymbol = resolveToHLName(symbol);
  const assetIndex = meta.universe.findIndex((a) => a.name === hlSymbol);
  const asset = meta.universe[assetIndex];

  if (!asset) {
    return {
      positionOpened: false,
      marketRegime: guessedRegime,
      reason: "asset_not_found",
      signalScore
    };
  }

  // Get proper decimals for this asset
  const qtyDecimals = asset.szDecimals ?? 4;
  
  // Format price with proper tick size based on Hyperliquid requirements
  let roundedPrice;
  if (entryPrice >= 1000) {
    // For high-value assets like BTC, ETH, MKR - tick size is 0.1
    roundedPrice = Math.round(entryPrice * 10) / 10;
  } else if (entryPrice >= 100) {
    // For medium-value assets - tick size is 0.01
    roundedPrice = Math.round(entryPrice * 100) / 100;
  } else if (entryPrice >= 10) {
    // For lower-value assets - tick size is 0.001
    roundedPrice = Math.round(entryPrice * 1000) / 1000;
  } else if (entryPrice >= 1) {
    // For assets between 1-10 - tick size is 0.0001
    roundedPrice = Math.round(entryPrice * 10000) / 10000;
  } else {
    // For very low-value assets - tick size is 0.00001
    roundedPrice = Math.round(entryPrice * 100000) / 100000;
  }
  
  const minSize = 1 / Math.pow(10, qtyDecimals);
  const stepSize = minSize;
  
  const roundToStep = (value: number, step: number): string => {
    const rounded = Math.floor(value / step) * step;
    return rounded.toFixed(step.toString().split(".")[1]?.length || 0);
  };

  // Ensure minimum quantity and proper rounding
  const qty = Math.max(rawQty.toNumber(), minSize);
  const roundedQty = roundToStep(qty, stepSize);

  // Convert roundedPrice to string
  const roundedPriceStr = roundedPrice.toString();
  
  // Validate quantity and price
  if (parseFloat(roundedQty) <= 0 || roundedPrice <= 0) {
    console.error(`❌ Invalid quantity or price: qty=${roundedQty}, price=${roundedPrice}`);
    return {
      positionOpened: false,
      marketRegime: guessedRegime,
      reason: "invalid_quantity_or_price",
      signalScore
    };
  }

  if (process.env.DRY_RUN === "true") {
    console.log(`[DRY RUN] Would execute ${symbol} ${direction.toUpperCase()} at ${roundedPriceStr}`);
    return { positionOpened: false, marketRegime: guessedRegime, reason: "dry_run", signalScore };
  }

  console.log(`🚀 Executing ${symbol} ${direction.toUpperCase()} @ ${roundedPriceStr} | Qty=${roundedQty} | Max Leverage=${maxLeverage}x`);


  // Market order execution
  let orderResult: OrderResult | null = null;
  const requestedSize = parseFloat(roundedQty);

  try {
    console.log(`📈 Executing market order for ${symbol} ${direction.toUpperCase()}`);
    
    // Use aggressive limit order to simulate market order
    // Apply the same tick size rounding to aggressive price
    // More aggressive pricing for testnet (5% instead of 1%)
    let aggressivePrice;
    if (isLong) {
      const rawAggressivePrice = roundedPrice * 1.05; // 5% above for buy (testnet)
      if (roundedPrice >= 1000) {
        aggressivePrice = Math.round(rawAggressivePrice * 10) / 10;
      } else if (roundedPrice >= 100) {
        aggressivePrice = Math.round(rawAggressivePrice * 100) / 100;
      } else if (roundedPrice >= 10) {
        aggressivePrice = Math.round(rawAggressivePrice * 1000) / 1000;
      } else if (roundedPrice >= 1) {
        aggressivePrice = Math.round(rawAggressivePrice * 10000) / 10000;
      } else {
        aggressivePrice = Math.round(rawAggressivePrice * 100000) / 100000;
      }
    } else {
      const rawAggressivePrice = roundedPrice * 0.95; // 5% below for sell (testnet)
      if (roundedPrice >= 1000) {
        aggressivePrice = Math.round(rawAggressivePrice * 10) / 10;
      } else if (roundedPrice >= 100) {
        aggressivePrice = Math.round(rawAggressivePrice * 100) / 100;
      } else if (roundedPrice >= 10) {
        aggressivePrice = Math.round(rawAggressivePrice * 1000) / 1000;
      } else if (roundedPrice >= 1) {
        aggressivePrice = Math.round(rawAggressivePrice * 10000) / 10000;
      } else {
        aggressivePrice = Math.round(rawAggressivePrice * 100000) / 100000;
      }
    }
    
    const aggressivePriceStr = aggressivePrice.toString();
    
    console.log(`🔧 [TESTNET] ${symbol} ${direction.toUpperCase()} - Market Price: $${roundedPrice}, Aggressive Price: $${aggressivePriceStr} (${isLong ? '+5%' : '-5%'})`);
    
    const marketRes = await getWalletClient().order({
      orders: [{
        a: assetIndex,
        b: isLong,
        p: aggressivePriceStr,
        s: roundedQty,
        r: false,
        t: { limit: { tif: "Ioc" } } // Use IOC for immediate execution
      }],
      grouping: "na"
    });

    const status = marketRes.response.data.statuses[0];
    console.log(`📊 Market order status: ${JSON.stringify(status)}`);
    
    const orderStatus = parseOrderStatus(status, requestedSize);
    
    if (orderStatus.error) {
      console.error(`❌ Market order failed: ${orderStatus.error}`);
      return {
        positionOpened: false,
        marketRegime: guessedRegime,
        reason: `market_order_failed: ${orderStatus.error}`,
        signalScore
      };
    } else if (orderStatus.filled) {
      console.log(`✅ Market order fully filled: ${orderStatus.fillPercentage.toFixed(2)}% @ $${orderStatus.avgFillPrice}`);
      orderResult = {
          success: true,
          orderId: orderStatus.oid,
          filledSize: orderStatus.filledSize,
          requestedSize: orderStatus.requestedSize,
          fillPercentage: orderStatus.fillPercentage,
          avgFillPrice: orderStatus.avgFillPrice,
          status: orderStatus
        };
      } else {
        // Order is resting, wait for fill
        console.log(`⏳ Market order resting, waiting for fill...`);
        orderResult = await waitForOrderFill(orderStatus.oid);
      }
    } catch (marketErr) {
      console.error(`❌ Market order exception: ${marketErr}`);
      return {
        positionOpened: false,
        marketRegime: guessedRegime,
        reason: `market_order_exception: ${marketErr}`,
        signalScore
      };
    }

    // If order failed
    if (!orderResult || !orderResult.success) {
      console.error(`❌ Market order failed for ${symbol}`);
      return {
        positionOpened: false,
        marketRegime: guessedRegime,
        reason: "market_order_failed",
        signalScore
      };
    }

      // Record trade opening in win rate tracker after successful order
  const side: 'LONG' | 'SHORT' = isLong ? 'LONG' : 'SHORT';
  
  try {
    const entryPrice = orderResult.avgFillPrice || roundedPrice;
    const positionSize = parseFloat(roundedQty);
    
    if (entryPrice > 0 && positionSize > 0) {
      winRateTracker.recordTradeOpen(symbol, entryPrice, positionSize, side);
    }
  } catch (trackerError) {
    console.warn(`⚠️ Failed to record trade opening for ${symbol}:`, trackerError);
  }

  recordAIPOS(
    symbol,
    orderResult.avgFillPrice || roundedPrice,
    orderResult.orderId.toString(),
    signalScore,
    guessedRegime,
    tp,
    sl,
    rsi,
    macdHist,
    emaSlope,
    atrPct,
    leverage,
    atr,
    adx,
    adxSlope,
    volumePct,
    parseFloat(safeBudget.toFixed(6)),
    false,
    0,
    divergenceScore,
    "anticipation",
    result.reason,
    "init",
    undefined,
    undefined,
    undefined,
    triggeredBy,
    entryReason,
    undefined, // extraTP
    undefined, // extraSL
    rrr, // extraRRR
    side // Pass the side information
  );

  return {
    positionOpened: true,
    marketRegime: guessedRegime,
    reason: "executed",
    signalScore
  };
}

export async function initBlockchain() {
  // Test network connectivity first
  const isConnected = await testNetworkConnectivity();
  if (!isConnected) {
    console.error(`❌ Cannot connect to Hyperliquid ${isTestnet ? 'testnet' : 'mainnet'} API`);
    console.error(`   Please check your internet connection and try again`);
    throw new Error(`Network connectivity test failed for ${isTestnet ? 'testnet' : 'mainnet'}`);
  }
  
  console.log("✅ Hyperliquid EVM initialized");
}

export const client = publicClient;

export const priceFeeds = {
  BTC: 'BTC/USDT',
  ETH: 'ETH/USDT',
  BNB: 'BNB/USDT',
  SOL: 'SOL/USDT',
  DOGE: 'DOGE/USDT',
  ADA: 'ADA/USDT',
  AVAX: 'AVAX/USDT',
  ATOM: 'ATOM/USDT',
  FIL: 'FIL/USDT',
  NEAR: 'NEAR/USDT',
  OP: 'OP/USDT',
  MKR: 'MKR/USDT',
  IMX: 'IMX/USDT',
  ARB: 'ARB/USDT',
  ALGO: 'ALGO/USDT',
  AAVE: 'AAVE/USDT',
  SAND: 'SAND/USDT',
  GALA: 'GALA/USDT',
  COMP: 'COMP/USDT',
  SNX: 'SNX/USDT',
  SUSHI: 'SUSHI/USDT',
  FET: 'FET/USDT',
  SUI: 'SUI/USDT',
  PYTH: 'PYTH/USDT',
  JUP: 'JUP/USDT',
  WIF: 'WIF/USDT',
  WLD: 'WLD/USDT',
  TAO: 'TAO/USDT',
  EIGEN: 'EIGEN/USDT'
};