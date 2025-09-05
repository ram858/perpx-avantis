/**
 * This module contains all types related to the Hyperliquid API.
 * @example
 * ```ts
 * import type { OrderParams } from "@nktkas/hyperliquid/types";
 *
 * const myOrder: OrderParams = {
 *   a: 0, // Asset index
 *   b: true, // Buy order
 *   p: "30000", // Price
 *   s: "0.1", // Size
 *   r: false, // Not reduce-only
 *   t: {
 *     limit: {
 *       tif: "Gtc", // Good-til-cancelled
 *     },
 *   },
 * };
 * ```
 * @module
 */
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
});
