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
import { keccak_256 } from "../deps/jsr.io/@noble/hashes/1.8.0/src/sha3.js";
import { encode as encodeMsgpack } from "../deps/jsr.io/@std/msgpack/1.0.3/encode.js";
import { decodeHex, encodeHex } from "../deps/jsr.io/@std/encoding/1.0.10/hex.js";
import { concat } from "../deps/jsr.io/@std/bytes/1.0.6/concat.js";
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
export function createL1ActionHash(action, nonce, vaultAddress, expiresAfter) {
    // 1. Action
    const actionBytes = encodeMsgpack(normalizeIntegersForMsgPack(action));
    // 2. Nonce
    const nonceBytes = new Uint8Array(8);
    new DataView(nonceBytes.buffer).setBigUint64(0, BigInt(nonce));
    // 3. Vault address
    const vaultMarker = Uint8Array.of(vaultAddress ? 0x01 : 0x00);
    const vaultBytes = vaultAddress ? decodeHex(vaultAddress.slice(2)) : new Uint8Array();
    // 4. Expires after
    const expiresMarker = new Uint8Array(expiresAfter !== undefined ? 1 : 0);
    const expiresBytes = new Uint8Array(expiresAfter !== undefined ? 8 : 0);
    if (expiresAfter !== undefined) {
        new DataView(expiresBytes.buffer).setBigUint64(0, BigInt(expiresAfter));
    }
    // Create a keccak256 hash
    const chunks = [
        actionBytes,
        nonceBytes,
        vaultMarker,
        vaultBytes,
        expiresMarker,
        expiresBytes,
    ];
    const bytes = concat(chunks);
    const hash = keccak_256(bytes);
    return `0x${encodeHex(hash)}`;
}
/** Layer to make {@link https://jsr.io/@std/msgpack | @std/msgpack} compatible with {@link https://github.com/msgpack/msgpack-javascript | @msgpack/msgpack}. */
function normalizeIntegersForMsgPack(obj) {
    const THIRTY_ONE_BITS = 2147483648;
    const THIRTY_TWO_BITS = 4294967296;
    if (typeof obj === "number" && Number.isInteger(obj) &&
        obj <= Number.MAX_SAFE_INTEGER && obj >= Number.MIN_SAFE_INTEGER &&
        (obj >= THIRTY_TWO_BITS || obj < -THIRTY_ONE_BITS)) {
        return BigInt(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(normalizeIntegersForMsgPack);
    }
    if (obj && typeof obj === "object" && obj !== null) {
        return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, normalizeIntegersForMsgPack(value)]));
    }
    return obj;
}
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
export async function signL1Action(args) {
    const { wallet, action, nonce, isTestnet = false, vaultAddress, expiresAfter, } = args;
    const domain = {
        name: "Exchange",
        version: "1",
        chainId: 1337,
        verifyingContract: "0x0000000000000000000000000000000000000000",
    };
    const types = {
        Agent: [
            { name: "source", type: "string" },
            { name: "connectionId", type: "bytes32" },
        ],
    };
    const actionHash = createL1ActionHash(action, nonce, vaultAddress, expiresAfter);
    const message = {
        source: isTestnet ? "b" : "a",
        connectionId: actionHash,
    };
    const signature = await abstractSignTypedData({ wallet, domain, types, message });
    return splitSignature(signature);
}
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
export async function signUserSignedAction(args) {
    const { wallet, action, types, chainId } = args;
    const domain = {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId,
        verifyingContract: "0x0000000000000000000000000000000000000000",
    };
    const signature = await abstractSignTypedData({ wallet, domain, types, message: action });
    return splitSignature(signature);
}
/** Signs typed data with the provided wallet using EIP-712. */
async function abstractSignTypedData(args) {
    const { wallet, domain, types, message } = args;
    if (isAbstractViemWalletClient(wallet) || isAbstractExtendedViemWalletClient(wallet)) {
        return await wallet.signTypedData({
            domain,
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "version", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" },
                ],
                ...types,
            },
            primaryType: Object.keys(types)[0],
            message,
        });
    }
    else if (isAbstractEthersSigner(wallet)) {
        return await wallet.signTypedData(domain, types, message);
    }
    else if (isAbstractEthersV5Signer(wallet)) {
        return await wallet._signTypedData(domain, types, message);
    }
    else if (isAbstractWindowEthereum(wallet)) {
        return await signTypedDataWithWindowEthereum(wallet, domain, types, message);
    }
    else {
        throw new Error("Unsupported wallet for signing typed data");
    }
}
/** Signs typed data using `window.ethereum` (EIP-1193) with `eth_signTypedData_v4` (EIP-712). */
async function signTypedDataWithWindowEthereum(ethereum, domain, types, message) {
    const accounts = await ethereum.request({
        method: "eth_requestAccounts",
        params: [],
    });
    if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error("No Ethereum accounts available");
    }
    const from = accounts[0];
    const dataToSign = JSON.stringify({
        domain,
        types: {
            EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
            ],
            ...types,
        },
        primaryType: Object.keys(types)[0],
        message,
    });
    return await ethereum.request({
        method: "eth_signTypedData_v4",
        params: [from, dataToSign],
    });
}
/** Splits a signature hexadecimal string into its components. */
function splitSignature(signature) {
    const r = `0x${signature.slice(2, 66)}`;
    const s = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(130, 132), 16);
    return { r, s, v };
}
/** Checks if the given value is an abstract viem wallet. */
export function isAbstractViemWalletClient(client) {
    return typeof client === "object" && client !== null &&
        "signTypedData" in client && typeof client.signTypedData === "function" &&
        client.signTypedData.length === 1;
}
/** Checks if the given value is an abstract ethers signer. */
export function isAbstractEthersSigner(client) {
    return typeof client === "object" && client !== null &&
        "signTypedData" in client && typeof client.signTypedData === "function" &&
        client.signTypedData.length === 3;
}
/** Checks if the given value is an abstract ethers v5 signer. */
export function isAbstractEthersV5Signer(client) {
    return typeof client === "object" && client !== null &&
        "_signTypedData" in client && typeof client._signTypedData === "function" &&
        client._signTypedData.length === 3;
}
/** Checks if the given value is an abstract extended viem wallet (e.g. privy `useSignTypedData`). */
export function isAbstractExtendedViemWalletClient(client) {
    return typeof client === "object" && client !== null &&
        "signTypedData" in client && typeof client.signTypedData === "function" &&
        client.signTypedData.length === 2;
}
/** Checks if the given value is an abstract `window.ethereum` object. */
export function isAbstractWindowEthereum(client) {
    return typeof client === "object" && client !== null &&
        "request" in client && typeof client.request === "function" &&
        client.request.length >= 1;
}
