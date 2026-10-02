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
- P0: Save to GitHub, build via expo.dev, exact signed build22 TestFlight fresh install / upgrade / cold start / offline startup. Collect native device crash or hang logs if it still freezes; no speculative splash edits.
- P1: Consolidate duplicate root/frontend projects with a planned migration and build-path verification; Android submission after iOS launch verification.
- P1: Brand font restoration implemented and verified as described below; web-compatible checkout if requested.
- P1: Consider native crash/launch diagnostics after this release is stable; no monitoring integration added in this task.
- P2: Reconcile older conflicting email/test documentation; ticket email enhancements and Mac support only if requested.

## Current follow-up: restore correct brand font
- User: "Add the correct font please"; clarification skipped, proceeding with originally requested Traditional Arabic, not a substitute.
- Original uploaded font located via attached assets: trado.ttf, https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/j8212gn3_trado.ttf . Both bundled TraditionalArabic-Regular.ttf files match its bytes exactly. SHA256 d79aa83116bf9922753fef5e7aac55dd450a9002f15eacbc214518cb020bf239.
- Font metadata verified: family Traditional Arabic, PostScript TraditionalArabic, Regular/400. Legacy TraditionalArabic-Bold.ttf is a byte-identical copy of the regular font, NOT a genuine bold font; it is not loaded or embedded. Existing fontWeight styling preserved, not a claim to have a separate bold cut.
- expo-font config now embeds the genuine regular face on iOS and Android. Android explicitly declares family TraditionalArabic, weight400; iOS uses embedded PostScript name TraditionalArabic, matching existing screen styles.
- Added src/hooks/useBrandFonts.ts in both projects and invoked from both root layouts: local runtime loading for Expo Go/web with FontDisplay.SWAP; errors logged; no readiness gate, conditional return, suspense, navigation remount or splash hold. Native builds have the font available at launch through embedding.
- Candidate now version1.0.1 build22. Existing iOS scene-lifecycle fix preserved. No backend/auth/payment logic changes, no credentials touched.
- Verification passed (test_reports/iteration_2.json): FontFaceSet TraditionalArabic loaded, welcome/login actual text font family correct, language/navigation usable, no overflow at390px; additional main check at320px passed. Failed/7-second-delayed TTF requests in isolated tests did not block welcome or navigation. Hook/layout ESLint clean.
- Scratch prebuild iOS: UIAppFonts includes TraditionalArabic-Regular.ttf and scene manifest retained. Android: xml_traditional_arabic.xml defines correct family/400 resource and font bytes match original. Root/frontend parity verified.
- Testing report's two low issues were false positives, verified by main with browser: login-submit-button is a TouchableOpacity/View; its actual child Text already renders TraditionalArabic. Welcome language option testIDs already exist (welcome-language-en-button etc.) and were successfully clicked. No unnecessary styling/auth changes made.
- Native signed TestFlight build22 remains NOT TESTED; no iOS/Android runtime available. Font work does not prove earlier Apple freeze resolved. No live API writes or credentials touched.
- User verification: "looks great on Expo Go". Correct font appearance confirmed by the user in Expo Go. This does not confirm the signed build22 TestFlight/App Store launch behavior; that remains P0.