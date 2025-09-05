(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TransportError = exports.HyperliquidError = void 0;
    /** Base class for all Hyperliquid SDK errors. */
    class HyperliquidError extends Error {
        constructor(message) {
            super(message);
            this.name = "HyperliquidError";
        }
    }
    exports.HyperliquidError = HyperliquidError;
    /** Base class for all transport-related errors. */
    class TransportError extends HyperliquidError {
        constructor(message) {
            super(message);
            this.name = "TransportError";
        }
    }
    exports.TransportError = TransportError;
});
