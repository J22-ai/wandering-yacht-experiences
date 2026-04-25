import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# Stripe
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')

# JWT
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# SMTP Email
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.dreamhost.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '465'))
SMTP_EMAIL = os.environ.get('SMTP_EMAIL', 'booking@wanderingyacht.com')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

# Google Calendar
GOOGLE_CALENDAR_ID = "1f685ad064eff11c51f7a78b3f935f2380e2c5114ebfa4e17e7b02f98714b6a6@group.calendar.google.com"
GOOGLE_CREDENTIALS_PATH = ROOT_DIR / "google_calendar_credentials.json"

# WebAuthn / Passkey
WEBAUTHN_RP_ID = os.environ.get("WEBAUTHN_RP_ID", "wandering-yacht-1.preview.emergentagent.com")
WEBAUTHN_RP_NAME = "WANDERING YACHT"
WEBAUTHN_ORIGIN = os.environ.get("WEBAUTHN_ORIGIN", "https://wandering-yacht-1.preview.emergentagent.com")

# App
APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://wandering-yacht-1.preview.emergentagent.com")
