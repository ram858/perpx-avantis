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
    exports.TypedEventTarget = void 0;
    class TypedEventTarget extends EventTarget {
        /**
         * Dispatches a synthetic event event to target and returns true if either
         * event's cancelable attribute value is false or its preventDefault() method
         * was not invoked, and false otherwise.
         */
        dispatchTypedEvent(_type, event) {
            return super.dispatchEvent(event);
        }
    }
    exports.TypedEventTarget = TypedEventTarget;
});
