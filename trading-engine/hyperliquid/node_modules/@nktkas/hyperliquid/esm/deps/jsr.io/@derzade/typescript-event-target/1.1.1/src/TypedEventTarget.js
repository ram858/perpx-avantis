export class TypedEventTarget extends EventTarget {
    /**
     * Dispatches a synthetic event event to target and returns true if either
     * event's cancelable attribute value is false or its preventDefault() method
     * was not invoked, and false otherwise.
     */
    dispatchTypedEvent(_type, event) {
        return super.dispatchEvent(event);
    }
}
