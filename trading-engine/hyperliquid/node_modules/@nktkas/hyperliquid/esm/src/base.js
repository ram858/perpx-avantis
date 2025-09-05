/** Base class for all Hyperliquid SDK errors. */
export class HyperliquidError extends Error {
    constructor(message) {
        super(message);
        this.name = "HyperliquidError";
    }
}
/** Base class for all transport-related errors. */
export class TransportError extends HyperliquidError {
    constructor(message) {
        super(message);
        this.name = "TransportError";
    }
}
