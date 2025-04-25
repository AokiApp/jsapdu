# Message Passing and Lifecycle in the Android Binding

## Introduction

This document explains the _message passing_, _event/method routing_, _error propagation_, and _object lifecycle_ mechanisms that underpin the Android binding.  
It is written to help you understand not just the “how”, but the “why” behind the design, with references to real code and diagrams to clarify complex flows.

---

## 1. Message Passing: EMA and React Native JS Bridge

### Why is message passing complex?

- The Expo Module API (EMA) and React Native JS Bridge only allow communication via function calls and primitive data—not direct object references or callbacks.
- All cross-runtime communication must be serialized, routed, and dispatched using receiver IDs.

### How does it work?

- **Function calls** from JS to JVM (and vice versa) are always accompanied by a receiver ID.
- The bridge serializes the call, sends it across the runtime boundary, and the target runtime looks up the object by receiver ID and dispatches the call.

---

## 2. How Calls and Events are Routed

### Step-by-step: Method Call from JS to JVM

1. **JS code** calls a method on a mirrored object (e.g., `card.transmit()`).
2. The JS bridge (`JsApduModule` in `index.ts`) serializes the call, including the receiver ID.
3. The JVM bridge receives the call, looks up the object in its registry (`ObjectRegistry.kt`), and invokes the method.
4. The result (or error) is serialized and sent back to JS.

### Step-by-step: Event from JVM to JS

1. **JVM code** triggers an event (e.g., card state change).
2. The event is sent via the EMA event system, always including the receiver ID.
3. The JS bridge receives the event, looks up the JS object, and dispatches the event handler.

### Diagram: Message Routing

```
JS (card.transmit) --[receiverId, args]--> Bridge --[receiverId, args]--> JVM
JVM (lookup by receiverId) --[result/error]--> Bridge --[result/error]--> JS
```

---

## 3. Error Propagation & Recovery Strategies

### Error Propagation

- Errors thrown on the JVM side are caught, wrapped (see `SmartCardError.kt`), and serialized back to JS.
- JS code receives errors as rejected Promises or thrown exceptions, with error codes and messages.

### Recovery Strategies

- **Timeouts:**  
  If a response is not received within a certain time, the call is considered failed (see `RESPONSE_TIMEOUT_MS` in `AndroidEmulatedCardImpl.kt`).
- **Graceful Degradation:**  
  If an object is missing (e.g., receiver ID not found), a specific error is returned, and the JS side can attempt recovery or cleanup.
- **Resource Cleanup:**  
  Both sides are responsible for unregistering and cleaning up objects to avoid leaks.

---

## 4. Object Lifecycle: Creation, Use, Destruction

### Creation

- When a JS object is created (e.g., `new SmartCardDevice()`), a corresponding JVM object is instantiated, and both are registered with the same receiver ID.

### Use

- All method calls and events are routed using the receiver ID.
- State is kept in sync via explicit events and method results.

### Destruction

- When an object is no longer needed, it must be explicitly released/unregistered on both sides.
- JVM: `ObjectRegistry.unregister(id)` or `object.unregister()`
- JS: `ObjectRegistry.unregister(id)`

### Diagram: Object Lifecycle

```
[Create JS object] --> [Bridge: create JVM object] --> [Register receiverId on both sides]
      |                                                         |
      v                                                         v
[Use: method calls/events routed by receiverId] <--------------> [State sync]
      |
      v
[Release: unregister on both sides]
```

---

## 5. Handling Large Numbers of Short-lived Objects

- The system is designed for rapid creation and destruction of objects (e.g., many card sessions).
- Registries are optimized for fast lookup and removal.
- Explicit lifecycle management is critical to avoid memory leaks.

---

## 6. Runtime Constraints & Robustness

- **Threading:**  
  All cross-runtime calls are dispatched on appropriate threads (see use of coroutines in Kotlin).
- **Async Operations:**  
  Many operations are asynchronous, using Promises (JS) and coroutines (JVM).
- **EMA/Bridge Limitations:**  
  Only serializable data can cross the bridge; all stateful logic must be encapsulated in mirrored objects.

---

## 7. Code References

- **JS Bridge:**
  - `packages/rn/src/index.ts` (`JsApduModule`, `ObjectRegistry`)
- **JVM Bridge:**
  - `packages/rn/android/src/main/java/expo/modules/jsapdu/JSApduModuleDefinition.kt`
  - `packages/rn/android/src/main/java/expo/modules/jsapdu/ObjectRegistry.kt`
- **Error Handling:**
  - `packages/rn/android/src/main/java/expo/modules/jsapdu/SmartCardError.kt`
- **Timeouts:**
  - `AndroidEmulatedCardImpl.kt`, `JsApduHostApduService.kt`

---

## 8. Further Reading

- For object mirroring and registry details, see `object-mirroring-and-routing.md`.
- For computer science background and design rationale, see `cs-concepts-faq-and-comparisons.md`.
