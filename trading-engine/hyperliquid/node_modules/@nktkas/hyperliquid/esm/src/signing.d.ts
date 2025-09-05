/**
 * This module contains functions for generating Hyperliquid transaction signatures
 * and interfaces to various wallet implementations.
 * @example
 * ```ts
 * import { signL1Action } from "@nktkas/hyperliquid/signing";
 *
 * const action = {
 *   type: "cancel",
 *   cancels: [{ a: 0, o: 12345 }],
 * };
 * const nonce = Date.now();
 *
 * const signature = await signL1Action({
 *   wallet,
 *   action,
 *   nonce,
 *   isTestnet: true, // Change to false for mainnet
 * });
 * ```
 * @example
 * ```ts
 * import { signUserSignedAction } from "@nktkas/hyperliquid/signing";
 *
 * const action = {
 *   type: "approveAgent",
 *   hyperliquidChain: "Testnet", // "Mainnet" or "Testnet"
 *   signatureChainId: "0x66eee",
 *   nonce: Date.now(),
 *   agentAddress: "0x...",
 *   agentName: "Agent",
 * };
 *
 * const signature = await signUserSignedAction({
 *   wallet,
 *   action,
 *   types: {
 *     "HyperliquidTransaction:ApproveAgent": [
 *       { name: "hyperliquidChain", type: "string" },
 *       { name: "agentAddress", type: "address" },
 *       { name: "agentName", type: "string" },
 *       { name: "nonce", type: "uint64" },
 *     ],
 *   },
 *   chainId: parseInt(action.signatureChainId, 16),
 * });
 * ```
 * @module
 */
import { type ValueMap, type ValueType } from "../deps/jsr.io/@std/msgpack/1.0.3/encode.js";
import type { Hex } from "./base.js";
export type { Hex };
export type { ValueMap, ValueType };
/** Abstract interface for a [viem wallet](https://viem.sh/docs/clients/wallet). */
export interface AbstractViemWalletClient {
    signTypedData(params: {
        domain: {
            name: string;
            version: string;
            chainId: number;
            verifyingContract: Hex;
        };
        types: {
            [key: string]: {
                name: string;
                type: string;
            }[];
        };
        primaryType: string;
        message: Record<string, unknown>;
    }): Promise<Hex>;
}
/** Abstract interface for an [ethers.js signer](https://docs.ethers.org/v6/api/providers/#Signer). */
export interface AbstractEthersSigner {
    signTypedData(domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: string;
    }, types: {
        [key: string]: {
            name: string;
            type: string;
        }[];
    }, value: Record<string, unknown>): Promise<string>;
}
/** Abstract interface for an [ethers.js v5 signer](https://docs.ethers.org/v5/api/providers/#Signer). */
export interface AbstractEthersV5Signer {
    _signTypedData(domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: string;
    }, types: {
        [key: string]: {
            name: string;
            type: string;
        }[];
    }, value: Record<string, unknown>): Promise<string>;
}
/** Abstract interface for an extended [viem wallet](https://viem.sh/docs/clients/wallet) (e.g. privy [useSignTypedData](https://docs.privy.io/reference/sdk/react-auth/functions/useSignTypedData#returns)). */
export interface AbstractExtendedViemWalletClient {
    signTypedData(params: {
        domain: {
            name: string;
            version: string;
            chainId: number;
            verifyingContract: Hex;
        };
        types: {
            [key: string]: {
                name: string;
                type: string;
            }[];
        };
        primaryType: string;
        message: Record<string, unknown>;
    }, options?: unknown): Promise<Hex>;
}
/** Abstract interface for a [window.ethereum](https://eips.ethereum.org/EIPS/eip-1193) object. */
export interface AbstractWindowEthereum {
    request(args: {
        method: any;
        params: any;
    }): Promise<any>;
}
/**
 * Create a hash of the L1 action.
 *
 * Note: Hash generation depends on the order of the action keys.
 * @param action - The action to be hashed.
 * @param nonce - Unique request identifier (recommended current timestamp in ms).
 * @param vaultAddress - Optional vault address used in the action.
 * @param expiresAfter - Optional expiration time of the action in milliseconds since the epoch.
 * @returns The hash of the action.
 */
export declare function createL1ActionHash(action: ValueType, nonce: number, vaultAddress?: Hex, expiresAfter?: number): Hex;
/**
 * Sign an L1 action.
 *
 * Note: Signature generation depends on the order of the action keys.
 * @param args - Arguments for signing the action.
 * @returns The signature components r, s, and v.
 * @example
 * ```ts
 * import { signL1Action } from "@nktkas/hyperliquid/signing";
 * import { privateKeyToAccount } from "viem/accounts";
 *
 * const wallet = privateKeyToAccount("0x..."); // Change to your private key
 *
 * const action = {
 *     type: "cancel",
 *     cancels: [
 *         { a: 0, o: 12345 }, // Asset index and order ID
 *     ],
 * };
 * const nonce = Date.now();
 *
 * const signature = await signL1Action({
 *     wallet,
 *     action,
 *     nonce,
 *     isTestnet: true, // Change to false for mainnet
 * });
 *
 * const response = await fetch("https://api.hyperliquid-testnet.xyz/exchange", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ action, signature, nonce }),
 * });
 * const body = await response.json();
 * ```
 */
export declare function signL1Action(args: {
    /** Wallet to sign the action. */
    wallet: AbstractViemWalletClient | AbstractEthersSigner | AbstractEthersV5Signer | AbstractExtendedViemWalletClient | AbstractWindowEthereum;
    /** The action to be signed. */
    action: ValueType;
    /** Unique request identifier (recommended current timestamp in ms). */
    nonce: number;
    /** Indicates if the action is for the testnet. Default is `false`. */
    isTestnet?: boolean;
    /** Optional vault address used in the action. */
    vaultAddress?: Hex;
    /** Optional expiration time of the action in milliseconds since the epoch. */
    expiresAfter?: number;
}): Promise<{
    r: Hex;
    s: Hex;
    v: number;
}>;
/**
 * Sign a user-signed action.
 *
 * Note: Signature generation depends on the order of types.
 * @param args - Arguments for signing the action.
 * @returns The signature components r, s, and v.
 * @example
 * ```ts
 * import { signUserSignedAction } from "@nktkas/hyperliquid/signing";
 * import { privateKeyToAccount } from "viem/accounts";
 *
 * const wallet = privateKeyToAccount("0x..."); // Change to your private key
 *
 * const action = {
 *     type: "approveAgent",
 *     hyperliquidChain: "Testnet", // "Mainnet" or "Testnet"
 *     signatureChainId: "0x66eee",
 *     nonce: Date.now(),
 *     agentAddress: "0x...", // Change to your agent address
 *     agentName: "Agent",
 * };
 *
 * const signature = await signUserSignedAction({
 *     wallet,
 *     action,
 *     types: {
 *         "HyperliquidTransaction:ApproveAgent": [
 *             { name: "hyperliquidChain", type: "string" },
 *             { name: "agentAddress", type: "address" },
 *             { name: "agentName", type: "string" },
 *             { name: "nonce", type: "uint64" },
 *         ],
 *     },
 *     chainId: parseInt(action.signatureChainId, 16),
 * });
 *
 * const response = await fetch("https://api.hyperliquid-testnet.xyz/exchange", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ action, signature, nonce: action.nonce }),
 * });
 * const body = await response.json();
 * ```
 */
export declare function signUserSignedAction(args: {
    /** Wallet to sign the action. */
    wallet: AbstractViemWalletClient | AbstractEthersSigner | AbstractEthersV5Signer | AbstractExtendedViemWalletClient | AbstractWindowEthereum;
    /** The action to be signed. */
    action: Record<string, unknown>;
    /** The types of the action. */
    types: {
        [key: string]: {
            name: string;
            type: string;
        }[];
    };
    /** The chain ID. */
    chainId: number;
}): Promise<{
    r: Hex;
    s: Hex;
    v: number;
}>;
/** Checks if the given value is an abstract viem wallet. */
export declare function isAbstractViemWalletClient(client: unknown): client is AbstractViemWalletClient;
/** Checks if the given value is an abstract ethers signer. */
export declare function isAbstractEthersSigner(client: unknown): client is AbstractEthersSigner;
/** Checks if the given value is an abstract ethers v5 signer. */
export declare function isAbstractEthersV5Signer(client: unknown): client is AbstractEthersV5Signer;
/** Checks if the given value is an abstract extended viem wallet (e.g. privy `useSignTypedData`). */
export declare function isAbstractExtendedViemWalletClient(client: unknown): client is AbstractViemWalletClient;
/** Checks if the given value is an abstract `window.ethereum` object. */
export declare function isAbstractWindowEthereum(client: unknown): client is AbstractWindowEthereum;
//# sourceMappingURL=signing.d.ts.map