"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveToHLName = resolveToHLName;
exports.resolveToBinancePair = resolveToBinancePair;
exports.getAllKnownSymbols = getAllKnownSymbols;
const symbolRegistry_json_1 = __importDefault(require("./symbolRegistry.json"));
function resolveToHLName(symbol) {
    const key = symbol.toUpperCase();
    return symbolRegistry_json_1.default[key]?.hl ?? symbol;
}
function resolveToBinancePair(symbol) {
    const key = symbol.toUpperCase();
    return symbolRegistry_json_1.default[key]?.binance ?? `${symbol.toUpperCase()}USDT`;
}
function getAllKnownSymbols() {
    return Object.keys(symbolRegistry_json_1.default);
}
//# sourceMappingURL=symbolResolver.js.map