# My Requests

## 🎯 初見の実装者へ
このドキュメントは**プロジェクトオーナーから実装者への要求仕様書**です。
「何を作るか」「なぜ作るか」「どう作るか」の方針を示します。

**環境準備がまだの方**: [guides/getting-started.md](./guides/getting-started.md) で開発環境をセットアップしてください。

---

## 📋 要求概要

この節は、実装者が対処すべき技術的側面を概説し、プロジェクト全体の品質と機能性向上を目指します。
**このドキュメントは直接編集しないでください。**

## Requests List

- want to implement `@aokiapp/jsapdu-interface` (core definition: [abstracts.ts](packages/interface/src/abstracts.ts:1) )
- Please refer `@aokiapp/jsapdu-pcsc` as an example implementation. This is a PC/SC implementation of the interface.
- Currently Android implementation is in progress. iOS implementation is planned in future.
- Please lean more on native implementation than JavaScript implementation. Of course, JavaScript implementation is also welcome.
- Write a document and memo about your progress or implementation details to `packages/rn/docs/*.md`. 
    - This will help 
        - other implementers to understand your work and contribute more effectively.
        - me to keep track of the progress and provide assistance if needed.
        - you to organize your thoughts and memories.
- Feel free to reach out if you have any questions or need further clarification on any aspect of the requests.
    - You can make a question via `question` XML tag.
- Steps to pre-implementation research:
    1. Read the interface definition in `packages/interface/src/abstracts.ts`.
    2. Explore existing implementations under `packages/` directory. Please don't try to read whole, as they are large.
    3. Research the current boilerplate code in `packages/rn` directory.
    4. Re-grasp my requests listed above by re-reading this document and ask questions to me (even if not necessar, i will push you to encourage a question).
    5. Create a requirement definition document in `packages/rn/docs/rdd` directory.
    6. Create a design document in `packages/rn/docs/ddd` directory.
    7. Create a technical specification document in `packages/rn/docs/tsd` directory.
    8. Start implementation in a new package under `packages/` directory.
- HCE is planned, but no need to implement at first.
- FeliCa is planned, but no need to implement at first.
- NDEF is out of scope of this library. Our focus is on APDU level communication.
- ISO-DEP is our main focus. Other proprietary protocols except FeliCa, such as MIFARE Classic, are out of scope.
- For Android implementation, ReaderMode is used, reader RF is activated at `acquireDevice` call, and deactivated when device is released. 
- Don't forget to research about what is "Nitro Modules" , which you should not know yet.
- You can use Context7 to research about external tech docs.
- You can use curl command to make external HTTP requests for browsing.
