# Test Credentials

## Test User Accounts
- Email: biotest@example.com | Password: test123456 | Name: Bio Test
- Email: bioauth@test.com | Password: test123456 | Name: Bio Auth User

## Auth Endpoints
- Register: POST /api/auth/register (fields: email, password, full_name, phone?, whatsapp_number?)
- Login: POST /api/auth/login (fields: email, password)
- Biometric Refresh: POST /api/auth/biometric-refresh (authenticated)
- Passkey Register: POST /api/passkey/register/options (authenticated)
- Passkey Auth: POST /api/passkey/auth/options (no auth)

## Stripe (LIVE KEYS - DO NOT TEST WITH REAL CARDS)
- Test Card: 4242 4242 4242 4242
- Expiry: Any future date (e.g., 12/28)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 10001)
