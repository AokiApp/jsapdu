# Android Binding Architecture Documentation

Welcome!  
This documentation is a deep, reader-first reference for the Androidバインディング (Android binding) of this project.  
It is designed for advanced maintainers and contributors who need to understand the _mechanisms_, _design intent_, _computer science concepts_, and _rationale_ behind the architecture—far beyond surface-level API explanations.

---

## How to Use These Docs

- **Start here** for a map of the documentation and guidance on where to find explanations for specific mechanisms.
- Each file is focused on a major architectural theme, with cross-references and diagrams.
- If you are struggling to understand how JS and JVM objects are mirrored, how receiver IDs work, or how message passing is coordinated, you are in the right place.

---

## Documentation Map

| File Name                            | Main Topics                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `object-mirroring-and-routing.md`    | Object mirroring, receiver ID system, registry mechanisms, routing from many objects       |
| `message-passing-and-lifecycle.md`   | Message passing, event/method routing, error propagation, object lifecycle, runtime issues |
| `cs-concepts-faq-and-comparisons.md` | CS background, design rationale, comparisons, and a comprehensive FAQ                      |

---

## Quickstart: Where to Find What

- **How does JS↔JVM object mirroring work?**  
  See: `object-mirroring-and-routing.md` (with diagrams)

- **How are method calls/events routed to the right object?**  
  See: `object-mirroring-and-routing.md` and `message-passing-and-lifecycle.md`

- **What are the main runtime constraints and how are they handled?**  
  See: `message-passing-and-lifecycle.md`

- **What are the key computer science ideas behind this design?**  
  See: `cs-concepts-faq-and-comparisons.md`

- **Stuck or confused?**  
  The FAQ in `cs-concepts-faq-and-comparisons.md` is designed to answer a wide range of deep and subtle questions.

---

## Philosophy

- **Reader-first:**  
  This documentation is written to reduce cognitive load, demystify complex flows, and provide historical and conceptual context.  
  You will find analogies, diagrams, and practical explanations throughout.

- **No API Reference:**  
  This is not an API reference. If you want to know what methods exist, read the code.  
  This is about _why_ and _how_ the system works, not _what_ the surface API is.

---

## Contributing

If you find a gap in the explanations, or a new pain point emerges, please extend these docs!  
The goal is to make the architecture as transparent and learnable as possible for future maintainers.
