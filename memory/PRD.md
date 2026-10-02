# WANDERING YACHT

## Product
Luxury mobile experience, boat/yacht and service booking app replicating the owner's Experience Pass branding, Traditional Arabic typography, euro prices and multilingual UI. Existing 30% deposit / 70% balance workflows, tickets, Stripe, SMTP and Google Calendar must remain unchanged.

## Architecture
- Expo Router / React Native; Expo SDK 57, React 19.2.3, React Native 0.86.3.
- FastAPI backend, MongoDB; production uses Railway / Atlas. Treat payments, emails, calendar and production data as live. No mutation tests without authorization.
- Root app/, src/, assets/, package.json, app.json and eas.json are used by the GitHub -> expo.dev build with blank base directory.
- frontend/ is the preview project and currently duplicates those sources. Both app/ and src/ trees were identical during this investigation. Do not edit one without checking the other. Refactoring is deferred to avoid changing build paths during the launch-blocker fix.
- Test credentials: memory/test_credentials.md. No new accounts or credentials created.

## Current blocker / evidence
Apple rejected version 1.0 (18), submission 892b05b7-7333-4f63-afdb-e98fc0c67d60, review September 29, 2026: frozen launch on iPhone 17 Pro Max and iPad Air 11-inch M3, iOS/iPadOS 27.0. Repeated rejections; Expo Go success is not release verification.

At investigation start both configs already said 1.0.1 (20). Apple did NOT review the same numbered build as the working tree. Build 18 binary, Xcode version, commit and device logs have not been provided; its exact failure is not confirmed.

Verified Expo documentation: SDK 57 uses the application lifecycle by default. Apps built with Xcode 27 / iOS 27 SDK need the scene lifecycle. SDK 57 requires expo >=57.0.23 and expo-build-properties with ios.enableSceneSupport=true. Neither project configured this. Source: https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md and https://docs.expo.dev/versions/latest/sdk/build-properties/ . This is a confirmed compatibility gap, not proof of the failure in build 18 without that build's metadata/logs.

The first diagnostic report suggested missing fonts or missing preventAutoHideAsync as definitive causes. That claim was not supported by evidence and was NOT used to add another blocking font/splash gate. The scene option belongs in app.json's plugin settings, NOT eas.json.

## Changes in this iteration
- Installed expo ~57.0.26 and expo-build-properties ~57.0.22 in BOTH projects using Expo installer; package manifests and lockfiles match.
- Root installed node_modules had still been SDK 54 even though its manifest declared 57; now aligned. This local mismatch is not proof cloud builds had the same issue.
- Enabled ios.enableSceneSupport in the expo-build-properties plugin in BOTH app.json files.
- Prepared version 1.0.1 build 21, bundle identifier unchanged: com.wanderingyacht.app.
- No auth, backend, payment, splash timer or navigation changes.
- Added stable testID props to welcome/profile/login screens in both source trees after the testing report flagged missing selectors; no login/authentication logic or navigation behavior changed.

## Verification
- Testing report: test_reports/iteration_1.json. Expo doctor passed in BOTH directories. Config, manifests, locks, app/ and src/ parity verified, including after testID changes.
- Scratch native prebuild passed: /tmp/wy_scratch/ios/WANDERINGYACHT/Info.plist contains scene manifest pointing at EXExpoAppSceneDelegate; AppDelegate.swift conforms to ExpoReactNativeFactoryProvider and no longer manually creates the window/starts React Native during application launch.
- Root production iOS JavaScript export succeeded to /tmp/wy_export_ios with --no-bytecode. IMPORTANT: normal Hermes bytecode export could not run because this container is ARM64/aarch64 and the package ships an x86-64 Linux hermesc binary (Exec format error). Confirmed host limitation, not an app-code failure; do not claim full native compilation/IPA verification.
- Preview smoke passed: welcome, language picker/English, Explore, profile, profile language and sign-in navigation. After testID addition main repeated the entire flow using deterministic testIDs and it passed. No credential submissions or live mutations. In-session offline navigation works; full offline web reload needs network, not a native app startup test.
- Layout lint passed. Modified screen lint has no errors; existing unused width/height, missing router effect dependency and require-style import warnings remain outside this native-config fix.
- No Xcode, iOS simulator or physical Apple device available in this environment. Actual signed TestFlight build21 on iOS/iPadOS27 is NOT TESTED. Exact build18 freeze cause and full resolution remain unconfirmed until native verification. No GitHub save, expo.dev build/upload, or App Store submission performed by agent.

## Backlog
- P0: Save to GitHub, build via expo.dev, exact signed build21 TestFlight fresh install / upgrade / cold start / offline startup. Collect native device crash or hang logs if it still freezes; no speculative splash edits.
- P1: Consolidate duplicate root/frontend projects with a planned migration and build-path verification; Android submission after iOS launch verification.
- P1: Restore/test bundled brand fonts without blocking startup; web-compatible checkout if requested.
- P1: Consider native crash/launch diagnostics after this release is stable; no monitoring integration added in this task.
- P2: Reconcile older conflicting email/test documentation; ticket email enhancements and Mac support only if requested.