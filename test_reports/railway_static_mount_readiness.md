# Railway static asset startup fix

## Confirmed issue and correction
User runtime traceback places server.py at /app/server.py and shows an eager StaticFiles check of the development-only /app/backend/static_fonts path. Both fonts and screenshots mounts now resolve from Path(__file__).resolve().parent. Asset files are git-tracked and their route prefixes remain unchanged.

## Verified
- Python lint: no errors in backend/server.py.
- backend/tests/test_static_assets_mounts.py: 14 passed, including a second run after making the test helper itself portable.
- Nested and flattened scratch layouts initialize real StaticFiles mounts from unrelated CWD.
- Font and screenshot HTTP200 bytes match source; missing files404; traversal outside asset roots blocked.
- Read-only requests to the running preview backend succeed for assets and categories.
- No registration, payment, booking, email, calendar or database mutations used in tests.

## Readiness-check limitations
The deployment checker twice analyzed local Expo/Kubernetes settings instead of the Railway backend target, returning FAIL for .env being gitignored and Expo supervisor not using --tunnel. These are not defects in this Python backend release. Do NOT commit production .env secrets to satisfy that check, and do not change the functioning Expo preview command. Compilation and environment parsing checks passed, but no overall automated readiness PASS is claimed.

Follow-up diagnosis confirmed the generic flags were inapplicable. It also incorrectly treated the workspace /app/backend/server.py location as the remote runtime and suggested changing Railway root/start settings. The user's actual /app/server.py traceback is authoritative for the failed remote process. Do not apply those unrelated setting suggestions: the portable path fix works in either layout.

## Remaining verification
The agent has NOT pushed GitHub or updated/started Railway remotely. User must push the corrected backend and retry their existing Railway release, then verify successful startup plus GET /api/fonts/TraditionalArabic-Regular.ttf and GET /api/screenshots/ios_01_welcome.png. Frontend build22 and its separate TestFlight launch verification remain unchanged.