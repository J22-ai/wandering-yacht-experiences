# iOS launch blocker: release verification

## Why another release is needed
Apple reviewed **1.0 (18)**, not the **1.0.1 (20)** that was in this workspace. Scene support was prepared in build21; the current candidate is **1.0.1 (22)**, including restored Traditional Arabic font embedding. Do not infer the submitted binary's code from the current source or from Expo Go.

SDK 57 requires opt-in scene support when building with Xcode 27. The official fix is now in both projects:

```json
["expo-build-properties", {"ios": {"enableSceneSupport": true}}]
```

Dependencies: expo ~57.0.26, expo-build-properties ~57.0.22. No explicit splash hold or font gate was added. Native startup happens before JavaScript; JavaScript timeouts cannot fix a native startup failure.

## Verification before sending to Apple
1. Save these changes using **Save to GitHub**. Verify that expo.dev builds that exact repository commit using the production profile, blank base directory (repository root).
2. Build on **expo.dev**. Verify version **1.0.1**, build **22**, bundle ID **com.wanderingyacht.app**, and record the Xcode/build-image version. This workspace has not uploaded or selected a build in App Store Connect.
3. Install this exact build through TestFlight. Confirm the build number on its TestFlight detail page. Test a fresh installation and, where available, an update from the earlier build.
4. On iOS 27 iPhone and an iPad that can install it, cold-launch, background/resume and relaunch repeatedly. Verify welcome page becomes interactive, language picker works, Explore opens and sign-in screen is reachable. Never make live payments merely to test startup.
5. Try launch with poor/no network: the welcome UI must still be reachable. Image/API failures must not be mistaken for a native splash freeze. Verify older supported iOS versions where devices are available.
6. Submit the **same tested build22** in App Store Connect, under version1.0.1 matching this config. Do not leave rejected build18 attached. iPhone-only configuration does not guarantee iPads cannot install the app in compatibility mode.

## Font-specific checks for build22
- Verify the welcome heading, input text, tab labels and sign-in text display the supplied Traditional Arabic face on-device, both online and offline.
- The genuine regular face is embedded into both native platforms; web/ExpoGo use a non-blocking loader. No genuine bold file was provided (legacy Bold.ttf duplicates regular), so existing emphasis styling must not be described as a separate bold font cut.
- Check a non-English language and return to English. Font loading must never become a requirement for navigation or splash hiding.

## If TestFlight still freezes
Do not resubmit. Record build number, device model, OS version, the first visible screen and whether the process terminates or remains running. Capture native launch/crash/hang logs through Xcode Devices and Simulators or macOS Console with the device connected; request App Review diagnostics if no local reproduction is possible. Preserve the corresponding expo.dev build log/commit and symbol files. The cause of Apple's build18 freeze remains unconfirmed until release evidence connects it to a specific defect.

## Developer checks
- Current results: Expo doctor passed both roots; native scratch generation and scene assertions passed; preview navigation and added testIDs passed. See test_reports/iteration_1.json and memory/PRD.md.
- Container limitation: aarch64 host cannot execute bundled x86-64 Linux hermesc (Exec format error). JS-only production export passed with --no-bytecode; native/Hermes compilation and signed app execution must still be checked in the actual iOS build environment. Do not change the app's JavaScript engine to work around this test-host limitation.
- Verify root and frontend app/, src/, app.json, eas.json, package.json and yarn.lock parity; bundled assets referenced by routes must be present in each project.
- Run Expo doctor in both directories, production iOS JS export from repository root, and iOS prebuild **in a scratch copy only**, with no CocoaPods install required for inspection.
- Verify generated Info.plist contains UIApplicationSceneManifest with UISceneDelegateClassName **EXExpoAppSceneDelegate**. On SDK57 the built-in delegate is used, not a generated SceneDelegate.swift.
- Verify AppDelegate conforms to ExpoReactNativeFactoryProvider and legacy window/startReactNative launch block was removed. Generated files are evidence, not a signed runtime test.
- Do not edit metro.config.js or package main; don't commit scratch ios/ directories.