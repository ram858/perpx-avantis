var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./src/base.js", "./src/clients/event.js", "./src/clients/public.js", "./src/clients/wallet.js", "./src/transports/http/http_transport.js", "./src/transports/websocket/websocket_transport.js"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // Base interfaces
    __exportStar(require("./src/base.js"), exports);
    // Clients
    __exportStar(require("./src/clients/event.js"), exports);
    __exportStar(require("./src/clients/public.js"), exports);
    __exportStar(require("./src/clients/wallet.js"), exports);
    // Transports
    __exportStar(require("./src/transports/http/http_transport.js"), exports);
    __exportStar(require("./src/transports/websocket/websocket_transport.js"), exports);
});
