# React Native Android build of @aokiapp/jsapdu-rn

This document records the current build architecture, constraints, and reasoning behind using the example app to validate the Android AAR, and clarifies when and why a standalone library-only build may not be reliable.

Canonical files:

- [`packages/rn/android/build.gradle`](packages/rn/android/build.gradle:1)
- [`packages/rn/android/gradle.properties`](packages/rn/android/gradle.properties:1)
- [`packages/rn/android/settings.gradle`](packages/rn/android/settings.gradle:1)
- [`examples/rn/android/build.gradle`](examples/rn/android/build.gradle:1)
- [`examples/rn/android/app/build.gradle`](examples/rn/android/app/build.gradle:1)
- [`examples/rn/android/gradle.properties`](examples/rn/android/gradle.properties:1)
- [`node_modules/react-native-nitro-modules/android/build.gradle`](node_modules/react-native-nitro-modules/android/build.gradle:1)

## Summary

- The library compiles against React Native Android core using compileOnly and dependency substitution.
- Nitro Modules (react-native-nitro-modules) integrate via Prefab and optionally React codegen under the new architecture.
- We verify every change by building examples/rn. This guarantees the Gradle plugin rewrites and Prefab/codegen paths are exercised.
- A pure standalone build of packages/rn may succeed for “old architecture” mode but can be brittle when plugin-based rewriting or codegen is required.

## Why building library-only can fail or be brittle

1. React Gradle plugin rewriting of com.facebook.react:react-native
   - Many libraries declare `implementation "com.facebook.react:react-native:+"`.
   - RN publishes Android artifacts under com.facebook.react:react-android for ≥0.71; the plugin rewrites requests.
   - In a library-only build without the app-level react plugin, nothing performs that rewrite, so dependency resolution fails.
   - We mitigate this with a global resolution strategy in [`packages/rn/android/build.gradle`](packages/rn/android/build.gradle:165):
     - Substitute com.facebook.react:react-native[+,specific] → com.facebook.react:react-android:0.81.1.

2. AndroidX
   - RN Android artifacts depend on AndroidX; `android.useAndroidX=true` is mandatory.
   - Missing this flag leads to Gradle errors like "Configuration contains AndroidX dependencies ... android.useAndroidX is not enabled".
   - We enable it in [`packages/rn/android/gradle.properties`](packages/rn/android/gradle.properties:1) and [`examples/rn/android/gradle.properties`](examples/rn/android/gradle.properties:23).

3. Nitro Modules: Prefab and optional codegen
   - Nitro sets `prefab true` and publishes headers via Prefab in [`node_modules/react-native-nitro-modules/android/build.gradle`](node_modules/react-native-nitro-modules/android/build.gradle:76).
   - The new architecture (`newArchEnabled=true`) applies `apply plugin: "com.facebook.react"` and triggers codegen and autolinking.
   - In a library-only build with `newArchEnabled=false`, Nitro falls back to `src/oldarch` without the react plugin; builds can succeed, but codegen is not exercised.
   - The example app ensures codegen/autolinking paths execute and Prefab publications are consumed by the app’s CMake pipeline.

4. Jetify/Prefab memory
   - Transforming large AARs like react-android–debug sometimes OOMs in constrained environments.
   - We increase Gradle heap and limit ABIs to arm64-v8a to stabilize.
   - See heap settings in [`packages/rn/android/gradle.properties`](packages/rn/android/gradle.properties:1) and [`examples/rn/android/gradle.properties`](examples/rn/android/gradle.properties:13).

## What we changed in this repo to stabilize builds

- Pin RN Android core to the published artifact:
  - [`packages/rn/android/build.gradle`](packages/rn/android/build.gradle:157) uses `compileOnly "com.facebook.react:react-android:0.81.1"` so the AAR never packages RN core.
- Global substitution to catch third-party `react-native:+` requests:
  - [`packages/rn/android/build.gradle`](packages/rn/android/build.gradle:165) uses dependencySubstitution to force `react-android:0.81.1`.
- Removed misapplied RN root project plugin from the library:
  - Root plugins like `com.facebook.react.rootproject` expect `:app`; we do not apply them in [`packages/rn/android/build.gradle`](packages/rn/android/build.gradle:34).
- Modernized AGP DSL:
  - Use `compileSdk` in [`packages/rn/android/build.gradle`](packages/rn/android/build.gradle:52) and in [`examples/rn/android/app/build.gradle`](examples/rn/android/app/build.gradle:78).
- Example app build features:
  - Enable Prefab in [`examples/rn/android/app/build.gradle`](examples/rn/android/app/build.gradle:75).
  - Limit ABIs via `ndk.abiFilters` in [`examples/rn/android/app/build.gradle`](examples/rn/android/app/build.gradle:86).
  - Add a placeholder for Nitro codegen JNI during clean/configure to avoid CMake deadlocks: [`examples/rn/android/app/build.gradle`](examples/rn/android/app/build.gradle:1).

## Supported build flows

A) Verified path (preferred): build the example app

This exercises React plugin rewriting, Prefab consumption, and (if enabled) codegen.

Commands:

```bash
cd examples/rn/android
./gradlew --info --no-parallel --max-workers=2 -PreactNativeArchitectures=arm64-v8a :react-native-nitro-modules:assembleDebug :aokiapp_jsapdu-rn:assembleDebug :app:assembleDebug
```

B) Library-only AAR (old-arch, no app/plugin participation)

This compiles the AAR with compileOnly RN core and Nitro old-arch sources.
It is useful for local packaging checks, but does not validate plugin rewrites or codegen.

Commands (run Gradle wrapper from the example app to reuse the Android SDK setup):

```bash
cd examples/rn/android
./gradlew --info --no-parallel --max-workers=2 -PreactNativeArchitectures=arm64-v8a -p ../../packages/rn/android :assembleDebug
```

## Why we keep using examples/rn as the test harness

- Guarantees the React Gradle plugin and settings plugin are present and active, matching real app environments:
  - [`examples/rn/android/build.gradle`](examples/rn/android/build.gradle:21) applies `com.facebook.react.rootproject`.
  - [`examples/rn/android/settings.gradle`](examples/rn/android/settings.gradle:1) includes the RN settings plugin and autolinking.
- Exercises Nitro codegen/autolinking when `newArchEnabled=true` in [`examples/rn/android/gradle.properties`](examples/rn/android/gradle.properties:35).
- Validates Prefab consumption via the app’s CMake pipeline.

## CI workflow plan (new workflow, ci.yaml remains untouched)

- Add `.github/workflows/rn-android-build.yml` with:
  - Java 21 (Temurin), Node ≥20.
  - Android SDK components: platforms;android-36, build-tools;36.0.0, ndk;27.1.12297006, cmake;3.22.1.
  - Yarn/NPM install at repo root (codegen relies on JS deps).
  - Sequential Gradle build of Nitro, the library, then app.
  - Upload artifacts:
    - library AAR(s): `packages/rn/android/build/outputs/aar/*`.
    - app APK: `examples/rn/android/app/build/outputs/apk/debug/app-debug.apk`.

## Troubleshooting

- OOM in JetifyTransform when resolving RN AAR:
  - Increase heap via `org.gradle.jvmargs` and restrict ABIs (`reactNativeArchitectures=arm64-v8a`).
- "Plugin with id 'com.facebook.react' not found" during library-only builds:
  - Ensure `newArchEnabled=false` for library-only mode, or build through the example app to provide the plugin.
- "Configuration contains AndroidX dependencies ... android.useAndroidX not enabled":
  - Set `android.useAndroidX=true` in both library and app gradle.properties.
- Autolinking/CMake deadlock during clean:
  - The placeholder codegen JNI directory hooks in the app mitigate this; build the app first.

## FAQ

**Q: Can packages/rn be built entirely standalone?**

A: For old-arch compilation (no React plugin/codegen participation), yes—assembling the AAR is possible with the constraints above. For fully realistic verification—including plugin rewriting, Nitro codegen, Prefab consumption—we use the example app harness, so the CI workflow builds examples/rn to exercise the complete stack.

**Q: Why pin RN to 0.81.1?**

A: We align to the version in [`examples/rn/package.json`](examples/rn/package.json:1) and [`packages/rn/package.json`](packages/rn/package.json:1). The Gradle substitution enforces consistent artifacts across subprojects.

**Q: Where are SDK versions controlled?**

A: `compileSdk`, `minSdk`, `targetSdk`, `ndkVersion`, and `buildToolsVersion` are set in the library’s and app’s Gradle files:

- [`packages/rn/android/build.gradle`](packages/rn/android/build.gradle:9)
- [`examples/rn/android/build.gradle`](examples/rn/android/build.gradle:1)
- [`examples/rn/android/app/build.gradle`](examples/rn/android/app/build.gradle:75)

## Appendix: Quick file map

- Library Gradle: [`packages/rn/android/build.gradle`](packages/rn/android/build.gradle:1)
- Library props: [`packages/rn/android/gradle.properties`](packages/rn/android/gradle.properties:1)
- Library settings: [`packages/rn/android/settings.gradle`](packages/rn/android/settings.gradle:1)
- App root Gradle: [`examples/rn/android/build.gradle`](examples/rn/android/build.gradle:1)
- App module Gradle: [`examples/rn/android/app/build.gradle`](examples/rn/android/app/build.gradle:1)
- App props: [`examples/rn/android/gradle.properties`](examples/rn/android/gradle.properties:1)
- Nitro Gradle: [`node_modules/react-native-nitro-modules/android/build.gradle`](node_modules/react-native-nitro-modules/android/build.gradle:1)

## Revision history

- 2025-11-24: Initial stabilization and documentation.
