# CS Concepts, FAQ, and Comparisons

## 1. Computer Science Concepts Behind the Architecture

### Distributed Object Systems

- The architecture borrows from distributed object systems (e.g., CORBA, Java RMI), where objects in different address spaces communicate via proxies and unique identifiers.
- **Receiver IDs** act as distributed object references, enabling method calls and state sync across JS and JVM.

### Actor Model and Message Passing

- Each mirrored object can be seen as an “actor” with its own state and message queue.
- All communication is asynchronous and routed by receiver ID, similar to actor-based systems (e.g., Erlang, Akka).

### Object Identity and Reference Management

- Object identity is decoupled from memory address; it is defined by the receiver ID.
- Registries on both sides ensure that identity and lifecycle are managed explicitly.

### Why Not Use Direct References?

- JS and JVM runtimes are isolated; direct references are impossible.
- The bridge only supports serializable data, so all stateful logic must be encapsulated in mirrored objects.

---

## 2. Historical Context & Design Rationale

- **EMA/React Native Bridge Limitations:**  
  The bridge is designed for simple, stateless function calls. This architecture extends it to support stateful, object-oriented flows.
- **Design Tradeoffs:**
  - Pros: Flexibility, scalability, clear object lifecycles.
  - Cons: Complexity, need for explicit cleanup, risk of registry leaks if not managed carefully.

---

## 3. Comparison with Other Systems

| System             | Object Identity | Message Routing | State Sync | Error Handling | Notes                        |
| ------------------ | --------------- | --------------- | ---------- | -------------- | ---------------------------- |
| This Project       | Receiver ID     | Registry lookup | Explicit   | Propagated     | Designed for JS-JVM          |
| JSI (React Native) | Host object ref | Direct/native   | Implicit   | Native         | Lower-level, less explicit   |
| Android Binder     | Binder handle   | Kernel routing  | Explicit   | Parcelable     | OS-level, not cross-language |
| CORBA/RMI          | Object ref      | ORB registry    | Explicit   | Exception      | Networked, language-agnostic |

---

## 4. FAQ

### Q: Why do we need receiver IDs?

A: Because JS and JVM cannot share direct object references. Receiver IDs provide a universal, serializable handle for routing calls and events.

### Q: What happens if an object is destroyed on one side but not the other?

A: Messages routed to a missing object will result in errors. Both sides must unregister objects to avoid leaks and stale references.

### Q: How are errors propagated across the bridge?

A: Errors are caught, wrapped (see `SmartCardError`), and serialized back to the caller. JS receives them as rejected Promises or exceptions.

### Q: How do we avoid memory leaks?

A: By explicitly unregistering objects on both sides when they are no longer needed. Use try/finally or async disposal patterns.

### Q: Can I pass a JS function or callback to the JVM?

A: No. Only serializable data (primitives, arrays, objects) can cross the bridge. All logic must be encapsulated in mirrored objects.

### Q: How does the system handle rapid creation/destruction of objects?

A: Registries are optimized for fast lookup and removal. The architecture is designed for high churn, but explicit cleanup is essential.

### Q: What are common pitfalls?

A:

- Forgetting to unregister objects, leading to leaks.
- Relying on implicit garbage collection—always clean up explicitly.
- Assuming state is always in sync—use events and method results to synchronize.

### Q: How can I debug registry or routing issues?

A:

- Log receiver IDs and registry actions on both sides.
- Check for missing/unregistered objects when errors occur.
- Use the FAQ and code references to trace flows.

---

## 5. Glossary

- **Receiver ID:** Unique string identifying a mirrored object across JS and JVM.
- **Registry:** Map from receiver ID to object instance, maintained on both JS and JVM.
- **Bridge:** The communication layer (EMA/React Native) that serializes and routes messages.
- **Mirrored Object:** An object with a counterpart in the other runtime, sharing the same receiver ID.

---

## 6. Further Reading

- For object mirroring and registry details, see `object-mirroring-and-routing.md`.
- For message passing and lifecycle, see `message-passing-and-lifecycle.md`.
