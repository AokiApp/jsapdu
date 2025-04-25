# Object Mirroring and Routing in the Android Binding

## Introduction

Welcome to the heart of the Android binding’s architecture: the object mirroring and routing system.  
This document is designed to demystify how JavaScript (JS) and JVM (Android/Kotlin) objects are kept in sync, how receiver IDs are used to route messages, and why this system is necessary for robust, high-performance cross-runtime communication.

---

## 1. What is Object Mirroring?

In this architecture, every significant object that exists in the JS runtime (such as a `SmartCardDevice`, `SmartCard`, or `EmulatedCard`) has a corresponding “mirror” object in the JVM runtime.  
This is not just a mapping of data, but a mapping of _identity_ and _lifecycle_.

- **Why?**

  - The Expo Module API (EMA) and React Native JS Bridge only allow communication at the function/variable level, not direct object references.
  - To enable stateful, object-oriented flows (e.g., holding a card session, tracking device state), we must “mirror” objects across the JS and JVM boundaries.

- **How?**
  - When a JS-side class is instantiated, a corresponding JVM-side class is also instantiated.
  - Both objects are assigned a unique _receiver ID_.
  - All subsequent method calls, events, and state changes are routed using this receiver ID.

---

## 2. Why Receiver IDs?

- **Problem:**  
  JS and JVM cannot share direct object references.  
  The bridge can only pass primitive values (strings, numbers, arrays, etc.).

- **Solution:**  
  Assign each mirrored object a unique receiver ID (UUID or similar).  
  Both runtimes maintain a registry mapping receiver IDs to actual object instances.

- **Benefits:**
  - Enables efficient lookup and routing of method calls/events.
  - Supports large numbers of short-lived objects without leaking memory.
  - Decouples object identity from memory address or runtime-specific handles.

---

## 3. Registry Mechanisms (JS & JVM)

### JS Side

- Maintains a `Map<string, any>` from receiver ID to object.
- See: `packages/rn/src/index.ts` (`ObjectRegistry` class).

### JVM Side

- Maintains a `ConcurrentHashMap<String, Any>` from receiver ID to object.
- See: `packages/rn/android/src/main/java/expo/modules/jsapdu/ObjectRegistry.kt`.

### Bidirectional Mapping

- Both registries support:
  - Registering a new object and getting its receiver ID.
  - Looking up an object by receiver ID.
  - Unregistering objects to prevent leaks.

---

## 4. Routing: From Many Objects to the Right One

Imagine a heap of objects on both JS and JVM sides.  
When a method call or event comes in, the system must:

1. **Extract the receiver ID** from the message.
2. **Look up the object** in the registry.
3. **Dispatch the call/event** to the correct object instance.

This enables the system to handle thousands of objects, each with its own state and lifecycle, without confusion or cross-talk.

### Diagram: Routing with Receiver IDs

Below is a conceptual diagram (not Mermaid, for clarity):

```
+-------------------+        +-------------------+
|   JS Object Heap  |        |  JVM Object Heap  |
|-------------------|        |-------------------|
| [id: A] Device1   |        | [id: A] Device1   |
| [id: B] Card1     |        | [id: B] Card1     |
| [id: C] Card2     |        | [id: C] Card2     |
+-------------------+        +-------------------+

        |   (method call: receiverId=B, method=transmit)
        v
+-------------------+   Bridge   +-------------------+
|   JS Registry     | ---------->|   JVM Registry    |
|  id -> object     |            |  id -> object     |
+-------------------+            +-------------------+
        |                              |
        v                              v
   [lookup B]                     [lookup B]
        |                              |
        v                              v
   Card1.transmit()              Card1.transmit()
```

- The message is routed _by receiver ID_ through the registry, ensuring the correct object is always targeted.

---

## 5. Synchronization & Consistency

- **State Sync:**

  - State changes (e.g., card inserted/removed) are propagated via events, always including the receiver ID.
  - Both sides must agree on object lifecycles; when one side destroys an object, the other must unregister it.

- **Pitfalls:**

  - If an object is destroyed on one side but not the other, messages may be routed to a stale or missing object.
  - Registries must be kept in sync to avoid leaks and bugs.

- **Best Practices:**
  - Always unregister objects when they are no longer needed.
  - Use try/finally or async disposal patterns to ensure cleanup.

---

## 6. Handling Large Numbers of Objects

- Both registries are optimized for fast lookup and removal.
- The system is designed to handle rapid creation and destruction of objects (e.g., many card sessions in quick succession).
- Memory leaks are avoided by strict lifecycle management and explicit unregistering.

---

## 7. Code References

- **JS Registry:**
  - `packages/rn/src/index.ts` (`ObjectRegistry`)
- **JVM Registry:**
  - `packages/rn/android/src/main/java/expo/modules/jsapdu/ObjectRegistry.kt`
- **Receiver ID assignment:**
  - See `Registrable` base class on JVM side.

---

## 8. Further Reading

- For message passing and lifecycle flows, see `message-passing-and-lifecycle.md`.
- For computer science background and design rationale, see `cs-concepts-faq-and-comparisons.md`.
