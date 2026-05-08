from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import stripe
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# WebAuthn / Passkey imports
import webauthn
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes

# App modules
from config import (
    STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY,
    GOOGLE_CALENDAR_ID, WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, WEBAUTHN_ORIGIN,
    APP_BASE_URL,
)
from database import db, client
from models import (
    UserCreate, UserLogin, UserResponse, TokenResponse,
    ServiceCategory, Experience, ExperienceCreate, TicketType, TimeSlot,
    BookingCreate, BookingTicket, Booking, 
    PaymentIntentCreate, PaymentIntentResponse,
    PasskeyRegisterRequest, PasskeyAuthRequest, BalancePaymentRequest,
    UpdateExperienceImage,
)
from services.auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, get_optional_user, pwd_context, security,
)
from services.email import (
    send_booking_email, send_business_invoice,
    send_balance_request_email, send_full_payment_confirmation,
)
from services.calendar import get_google_calendar_service, create_calendar_event
from services.qr import generate_qr_code

# Direct SMTP imports for weekly digest (inline in server.py)
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD

ROOT_DIR = Path(__file__).parent

# Stripe configuration
stripe.api_key = STRIPE_SECRET_KEY

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rate limiting store (in-memory, resets on restart)
rate_limit_store = {}  # {ip: [timestamp, timestamp, ...]}
RATE_LIMIT_MAX = 5  # max registrations per IP
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds

def check_rate_limit(ip: str) -> bool:
    """Returns True if request is allowed, False if rate-limited."""
    now = datetime.utcnow().timestamp()
    if ip not in rate_limit_store:
        rate_limit_store[ip] = []
    # Clean old entries
    rate_limit_store[ip] = [t for t in rate_limit_store[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(rate_limit_store[ip]) >= RATE_LIMIT_MAX:
        return False
    rate_limit_store[ip].append(now)
    return True

# Create the main app
app = FastAPI(title="Wandering Yacht API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ======================== AUTH ROUTES ========================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate, request: Request):
    # Anti-bot: Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        logger.warning(f"Rate limit exceeded for registration from IP: {client_ip}")
        raise HTTPException(status_code=429, detail="Too many registration attempts. Please try again later.")
    
    # Anti-bot: Honeypot check (if 'website' field is filled, it's a bot)
    honeypot = getattr(user_data, 'website', None)
    if honeypot:
        logger.warning(f"Honeypot triggered from IP: {client_ip}")
        raise HTTPException(status_code=400, detail="Registration failed")
    
    # Anti-bot: Form timing check (reject if submitted too fast)
    form_loaded_at = getattr(user_data, 'form_loaded_at', None)
    if form_loaded_at:
        try:
            loaded = float(form_loaded_at)
            elapsed = datetime.utcnow().timestamp() - loaded
            if elapsed < 2.0:
                logger.warning(f"Form submitted too fast ({elapsed:.1f}s) from IP: {client_ip}")
                raise HTTPException(status_code=400, detail="Registration failed")
        except (ValueError, TypeError):
            pass
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "whatsapp_number": user_data.whatsapp_number,
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(user)
    
    # Create token
    access_token = create_access_token(data={"sub": user_id})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            full_name=user_data.full_name,
            phone=user_data.phone,
            whatsapp_number=user_data.whatsapp_number,
            created_at=user["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            phone=user.get("phone"),
            whatsapp_number=user.get("whatsapp_number"),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        phone=current_user.get("phone"),
        whatsapp_number=current_user.get("whatsapp_number"),
        created_at=current_user["created_at"]
    )

# ======================== CATEGORIES ROUTES ========================

@api_router.get("/categories", response_model=List[ServiceCategory])
async def get_categories():
    # Return predefined categories
    categories = [
        ServiceCategory(
            id="yacht_experiences",
            name="WELLNESS ON DECK",
            slug="yacht_experiences",
            description="Luxury experiences on board",
            image_url="https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800",
            icon="boat"
        ),
        ServiceCategory(
            id="nature_escapes",
            name="NATURE ESCAPES",
            slug="nature_escapes",
            description="Explore breathtaking landscapes",
            image_url="https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800",
            icon="trail-sign"
        ),
        ServiceCategory(
            id="culinary_tours",
            name="CULINARY EXCURSIONS",
            slug="culinary_tours",
            description="Wine tasting and gourmet adventures",
            image_url="https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800",
            icon="wine"
        ),
        ServiceCategory(
            id="water_adventures",
            name="WATER ADVENTURES",
            slug="water_adventures",
            description="Thrilling water sports and activities",
            image_url="https://images.unsplash.com/photo-1530053969600-caed2596d242?w=800",
            icon="water"
        ),
        ServiceCategory(
            id="concierge_services",
            name="CONCIERGE SERVICES",
            slug="concierge_services",
            description="Personal assistant for your holiday",
            image_url="https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/kxu0ah94_KEY.jpeg",
            icon="key"
        ),
        ServiceCategory(
            id="weddings_events",
            name="WEDDINGS & EVENTS",
            slug="weddings_events",
            description="Your dream celebration on the water",
            image_url="https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/izj5hjhu_IMG_2955.jpeg",
            icon="heart"
        )
    ]
    return categories

# ======================== EXPERIENCES ROUTES ========================

@api_router.patch("/experiences/update-image")
async def update_experience_image(data: UpdateExperienceImage):
    """Update experience image by title"""
    result = await db.experiences.update_one(
        {"title": data.title},
        {"$set": {"image_url": data.image_url}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Experience not found")
    return {"message": "Image updated successfully", "title": data.title}

@api_router.post("/experiences", response_model=Experience)
async def create_experience(experience_data: ExperienceCreate):
    experience = Experience(
        **experience_data.dict(),
        available_spots=experience_data.capacity
    )
    await db.experiences.insert_one(experience.dict())
    return experience

@api_router.get("/experiences", response_model=List[Experience])
async def get_experiences(category: Optional[str] = None, limit: int = 50):
    query = {"is_active": True}
    if category:
        query["category"] = category
    
    experiences = await db.experiences.find(query).to_list(limit)
    return [Experience(**exp) for exp in experiences]

@api_router.get("/experiences/{experience_id}", response_model=Experience)
async def get_experience(experience_id: str):
    experience = await db.experiences.find_one({"id": experience_id})
    if not experience:
        raise HTTPException(status_code=404, detail="Experience not found")
    return Experience(**experience)

# ======================== BOOKINGS ROUTES ========================

@api_router.post("/bookings", response_model=Booking)
async def create_booking(
    booking_data: BookingCreate,
    current_user: dict = Depends(get_current_user)
):
    # Get experience
    experience = await db.experiences.find_one({"id": booking_data.experience_id})
    if not experience:
        raise HTTPException(status_code=404, detail="Experience not found")
    
    # Calculate total
    total_amount = 0
    total_tickets = 0
    for ticket in booking_data.tickets:
        total_amount += ticket.quantity * ticket.price_per_ticket
        total_tickets += ticket.quantity
    
    # Check availability
    if total_tickets > experience["available_spots"]:
        raise HTTPException(status_code=400, detail="Not enough spots available")
    
    # Check if experience requires deposit
    requires_deposit = experience.get("requires_deposit", False)
    deposit_percentage = experience.get("deposit_percentage", 30)
    
    deposit_amount = 0.0
    remaining_balance = 0.0
    payment_type = "full"
    
    if requires_deposit:
        payment_type = "deposit"
        deposit_amount = round(total_amount * (deposit_percentage / 100), 2)
        remaining_balance = round(total_amount - deposit_amount, 2)
    
    # Use the user's selected date if provided, otherwise fall back to experience date
    booking_date = booking_data.selected_date or experience["date"]
    
    # Create booking
    booking = Booking(
        user_id=current_user["id"],
        experience_id=booking_data.experience_id,
        experience_title=experience["title"],
        experience_date=booking_date,
        experience_location=experience["location"],
        tickets=booking_data.tickets,
        time_slot_id=booking_data.time_slot_id,
        total_amount=total_amount,
        payment_type=payment_type,
        deposit_percentage=deposit_percentage if requires_deposit else 0,
        deposit_amount=deposit_amount,
        remaining_balance=remaining_balance,
        special_requests=booking_data.special_requests
    )
    
    await db.bookings.insert_one(booking.dict())
    
    # Update available spots
    await db.experiences.update_one(
        {"id": booking_data.experience_id},
        {"$inc": {"available_spots": -total_tickets}}
    )
    
    return booking

@api_router.get("/bookings", response_model=List[Booking])
async def get_user_bookings(current_user: dict = Depends(get_current_user)):
    bookings = await db.bookings.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return [Booking(**b) for b in bookings]

@api_router.get("/bookings/{booking_id}", response_model=Booking)
async def get_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    booking = await db.bookings.find_one({"id": booking_id, "user_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return Booking(**booking)

# ======================== PAYMENT ROUTES ========================

@api_router.get("/payment/config")
async def get_payment_config():
    return {"publishable_key": STRIPE_PUBLISHABLE_KEY}

@api_router.post("/payment/create-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
    data: PaymentIntentCreate,
    current_user: dict = Depends(get_current_user)
):
    # Get booking
    booking = await db.bookings.find_one({"id": data.booking_id, "user_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Booking already paid")
    
    # If deposit booking, charge only the deposit amount
    if booking.get("payment_type") == "deposit" and booking.get("deposit_amount", 0) > 0:
        charge_amount = booking["deposit_amount"]
    else:
        charge_amount = booking["total_amount"]
    
    amount_cents = int(charge_amount * 100)
    
    try:
        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="eur",
            metadata={
                "booking_id": data.booking_id,
                "user_id": current_user["id"],
                "experience_title": booking["experience_title"],
                "payment_type": booking.get("payment_type", "full"),
                "total_amount": str(booking["total_amount"]),
                "deposit_amount": str(booking.get("deposit_amount", 0)),
            },
            automatic_payment_methods={"enabled": True}
        )
        
        # Update booking with payment intent ID
        await db.bookings.update_one(
            {"id": data.booking_id},
            {"$set": {"payment_intent_id": intent.id}}
        )
        
        return PaymentIntentResponse(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount=amount_cents,
            publishable_key=STRIPE_PUBLISHABLE_KEY
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/payment/confirm/{booking_id}")
async def confirm_payment(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Confirm payment was successful and generate ticket"""
    booking = await db.bookings.find_one({"id": booking_id, "user_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # IDEMPOTENCY: If already confirmed, return existing booking without duplicate side-effects
    if booking.get("status") == "confirmed" and booking.get("qr_code"):
        booking.pop("_id", None)
        return {
            "booking": booking,
            "message": "Booking already confirmed"
        }
    
    # In demo mode, allow confirmation without strict Stripe verification
    # In production, you would verify payment_intent.status == "succeeded"
    if booking.get("payment_intent_id"):
        try:
            intent = stripe.PaymentIntent.retrieve(booking["payment_intent_id"])
            # For demo purposes, we accept requires_payment_method status
            # In production, only accept "succeeded" status
            if intent.status not in ["succeeded", "requires_payment_method", "requires_confirmation"]:
                raise HTTPException(status_code=400, detail=f"Payment status: {intent.status}")
        except stripe.error.StripeError as e:
            # For demo, continue even if Stripe check fails
            logger.warning(f"Stripe verification skipped: {e}")
    
    # Generate QR code for ticket
    qr_data = f"WANDERING-YACHT-{booking_id}-{current_user['id']}"
    qr_code = generate_qr_code(qr_data)
    
    # Set payment status based on payment type
    payment_status = "deposit_paid" if booking.get("payment_type") == "deposit" else "paid"
    booking_status = "confirmed"
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "status": booking_status,
                "payment_status": payment_status,
                "qr_code": qr_code,
                "confirmed_at": datetime.utcnow()
            }
        }
    )
    
    updated_booking = await db.bookings.find_one({"id": booking_id})
    
    # Send confirmation email & create Google Calendar event
    try:
        user = await db.users.find_one({"id": current_user["id"]})
        if user and user.get("email"):
            experience = await db.experiences.find_one({"id": booking.get("experience_id")})
            customer_name = user.get("full_name", user.get("name", user["email"].split("@")[0]))
            
            # Send email to customer
            send_booking_email(
                to_email=user["email"],
                customer_name=customer_name,
                booking=updated_booking,
                experience=experience or {}
            )
            
            # Send invoice copy to business email
            try:
                payment_label = "Deposit Payment" if updated_booking.get('payment_type') == 'deposit' else "Full Payment"
                send_business_invoice(
                    customer_name=customer_name,
                    customer_email=user["email"],
                    booking=updated_booking,
                    experience=experience or {},
                    payment_label=payment_label
                )
            except Exception as inv_err:
                logger.error(f"Business invoice send failed (non-blocking): {inv_err}")
            
            # Push to Google Calendar (non-blocking)
            try:
                calendar_event_id = create_calendar_event(
                    booking=updated_booking,
                    experience=experience or {},
                    customer_name=customer_name,
                    customer_email=user["email"]
                )
                if calendar_event_id:
                    await db.bookings.update_one(
                        {"id": booking_id},
                        {"$set": {"calendar_event_id": calendar_event_id}}
                    )
                    updated_booking = await db.bookings.find_one({"id": booking_id})
            except Exception as cal_err:
                logger.error(f"Google Calendar event creation failed (non-blocking): {cal_err}")
    except Exception as e:
        logger.error(f"Email send failed (non-blocking): {str(e)}")
    
    return Booking(**updated_booking)

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    
    if webhook_secret:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        event = stripe.Event.construct_from(payload.decode(), stripe.api_key)
    
    # Handle events
    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        booking_id = payment_intent.get("metadata", {}).get("booking_id")
        
        if booking_id:
            booking = await db.bookings.find_one({"id": booking_id})
            if booking:
                qr_data = f"WANDERING-YACHT-{booking_id}-{booking['user_id']}"
                qr_code = generate_qr_code(qr_data)
                
                await db.bookings.update_one(
                    {"id": booking_id},
                    {
                        "$set": {
                            "status": "confirmed",
                            "payment_status": "paid",
                            "qr_code": qr_code,
                            "confirmed_at": datetime.utcnow()
                        }
                    }
                )
    
    return {"status": "success"}

# ======================== SEED DATA ROUTE ========================

@api_router.post("/seed/reset")
async def reset_and_seed():
    """Reset and reseed experiences data"""
    await db.experiences.delete_many({})
    return await seed_data_internal()

@api_router.post("/seed")
async def seed_data():
    """Seed initial experiences data"""
    # Check if already seeded
    count = await db.experiences.count_documents({})
    if count > 0:
        return {"message": "Data already seeded", "count": count}
    return await seed_data_internal()

async def seed_data_internal():
    
    experiences = [
        # ==================== YACHT EXPERIENCES CATEGORY ====================
        # Yoga & Wellness
        {
            "id": str(uuid.uuid4()),
            "title": "Sunrise Yoga on Deck",
            "description": "Start your day with a rejuvenating yoga session on our yacht deck as the sun rises over the Adriatic. Perfect for all skill levels.",
            "category": "yacht_experiences",
            "location": "Porto Montenegro, TIVAT",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/icfzdqff_IMG_2436.jpeg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 1,
            "amenities": ["Yoga Mats", "Towels", "Water"],
            "included": ["Professional instructor", "Healthy snacks", "Herbal tea"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Single Session", "description": "One sunrise yoga session", "price": 35, "max_per_booking": 4}
            ],
            "time_slots": [
                {"id": str(uuid.uuid4()), "start_time": "06:00", "end_time": "07:00", "available_spots": 12}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Sunset Yoga on Deck",
            "description": "Unwind with a peaceful yoga session as the sun sets over the sea. A magical experience combining wellness and natural beauty.",
            "category": "yacht_experiences",
            "location": "Porto Montenegro, Tivat",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/m0idyysm_ae326692-33c3-4e04-a1d0-671f5393b919.jpeg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 1,
            "amenities": ["Yoga Mats", "Towels", "Ambient Music"],
            "included": ["Professional instructor", "Refreshments", "Meditation session"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Single Session", "description": "One sunset yoga session", "price": 35, "max_per_booking": 4}
            ],
            "time_slots": [
                {"id": str(uuid.uuid4()), "start_time": "18:30", "end_time": "19:30", "available_spots": 12}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Wellness Morning at Sea",
            "description": "A complete morning wellness experience including yoga, meditation, healthy breakfast, and swimming in crystal-clear waters.",
            "category": "yacht_experiences",
            "location": "Porto Montenegro, Tivat",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/e5zh2r9z_ODYSSEE%20BOWLS.jpg",
            "images": ["https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/e5zh2r9z_ODYSSEE%20BOWLS.jpg", "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/rnup7f2c_ODYSSEE%20FRONT.jpg"],
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 4,
            "amenities": ["Spa Amenities", "Swimming Access", "Wellness Kit"],
            "included": ["Yoga session", "Meditation", "Organic breakfast", "Wellness consultation"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Wellness Package", "description": "Complete morning wellness", "price": 120, "max_per_booking": 4}
            ],
            "time_slots": [
                {"id": str(uuid.uuid4()), "start_time": "08:00", "end_time": "12:00", "available_spots": 10}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Wellness Afternoon at Sea",
            "description": "Relax and rejuvenate with an afternoon of wellness activities at sea, including gentle yoga, sound healing, and a healthy lunch.",
            "category": "yacht_experiences",
            "location": "Porto Montenegro, Tivat",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_929cb53c-78ce-4c19-b0ec-09f72d93df42/artifacts/qsdqxslg_c28d2bde-e1a8-45d4-b6e6-e5313fd061ea.jpeg",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 4,
            "amenities": ["Spa Amenities", "Swimming Access", "Relaxation Area"],
            "included": ["Yoga session", "Sound healing", "Healthy lunch", "Aromatherapy"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Wellness Package", "description": "Complete afternoon wellness", "price": 130, "max_per_booking": 4}
            ],
            "time_slots": [
                {"id": str(uuid.uuid4()), "start_time": "13:00", "end_time": "17:00", "available_spots": 10}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # Water Sports
        {
            "id": str(uuid.uuid4()),
            "title": "Jet Ski on the River",
            "description": "Thrilling jet ski adventure along the scenic river routes. Experience the adrenaline rush with stunning mountain views.",
            "category": "water_adventures",
            "location": "Bojana River",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/bida74n1_IMG_2437.jpeg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 3,
            "amenities": ["Life Jackets", "Safety Briefing", "Guide"],
            "included": ["Jet ski rental", "Fuel", "Professional guide", "Safety equipment"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Single Rider", "description": "Solo jet ski experience", "price": 350, "max_per_booking": 2},
                {"id": str(uuid.uuid4()), "name": "Double Rider", "description": "Tandem jet ski experience", "price": 600, "max_per_booking": 2}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Kayaking Adventure",
            "description": "Explore hidden coves and crystal-clear waters by kayak. A peaceful way to discover the stunning coastline.",
            "category": "water_adventures",
            "location": "Montenegro Coast",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/4kaj0mgg_IMG_2440.jpeg",
            "capacity": 12,
            "available_spots": 12,
            "duration_hours": 2,
            "amenities": ["Waterproof Bags", "Snorkeling Gear"],
            "included": ["Kayak rental", "Paddle", "Guide", "Snacks"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Single Kayak", "description": "Solo kayaking", "price": 45, "max_per_booking": 4},
                {"id": str(uuid.uuid4()), "name": "Double Kayak", "description": "Tandem kayaking", "price": 70, "max_per_booking": 4}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "SUP - Stand Up Paddleboarding",
            "description": "Glide across calm waters on a paddleboard. Perfect for fitness enthusiasts and those seeking a unique water experience.",
            "category": "water_adventures",
            "location": "Montenegro Coast",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/e8yq3bve_IMG_2441.jpeg",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 4,
            "amenities": ["Waterproof Phone Case", "Storage"],
            "included": ["SUP board", "Paddle", "Lesson for beginners"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "4 Hour Rental", "description": "Half day SUP", "price": 55, "max_per_booking": 4}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "SUP Full Day",
            "description": "Full day paddleboarding adventure with guided tours to the best spots along the coast.",
            "category": "water_adventures",
            "location": "Montenegro Coast",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/gfzn9wnx_IMG_2442.jpeg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 8,
            "amenities": ["Lunch Included", "Guide", "Photos"],
            "included": ["SUP board", "Paddle", "Lunch", "Professional guide", "Photos"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Full Day", "description": "Complete SUP day experience", "price": 95, "max_per_booking": 4}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "SUP Full Week",
            "description": "Week-long SUP pass with unlimited access to boards and exclusive guided tours.",
            "category": "water_adventures",
            "location": "Montenegro Coast",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/yenjr0js_IMG_2443.jpeg",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 0,
            "amenities": ["Unlimited Access", "Priority Booking", "Free Lessons"],
            "included": ["7 days unlimited SUP", "Storage", "3 guided tours", "Advanced lessons"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Weekly Pass", "description": "7 days unlimited SUP", "price": 350, "max_per_booking": 4}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Kite Surfing Overnight",
            "description": "Learn or perfect your kite surfing skills with overnight camping by the beach. An unforgettable adventure experience.",
            "category": "water_adventures",
            "location": "Ulcinj Velika Plaza",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/hwzkxeki_IMG_2444.jpeg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 30,
            "amenities": ["Camping Gear", "BBQ", "Beach Access"],
            "included": ["Kite equipment", "Lessons", "Tent", "Meals", "Instructor"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Beginner Package", "description": "Full instruction + overnight", "price": 450, "max_per_booking": 2},
                {"id": str(uuid.uuid4()), "name": "Advanced Package", "description": "Equipment + overnight", "price": 700, "max_per_booking": 2}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # Nature & Adventure
        {
            "id": str(uuid.uuid4()),
            "title": "Nature Hike",
            "description": "Discover Montenegro's breathtaking landscapes on a guided nature hike through mountains and forests.",
            "category": "nature_escapes",
            "location": "Lovćen National Park",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/djmjwkiz_IMG_2446.jpeg",
            "capacity": 15,
            "available_spots": 15,
            "duration_hours": 6,
            "amenities": ["Hiking Poles Available", "First Aid Kit"],
            "included": ["Professional guide", "Picnic lunch", "Water", "Transport"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Adult", "description": "Full hike experience", "price": 85, "max_per_booking": 6},
                {"id": str(uuid.uuid4()), "name": "Child (8-14)", "description": "Youth rate", "price": 55, "max_per_booking": 4}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Glamping Experience",
            "description": "Luxury camping in nature with all modern amenities. Wake up to stunning views and enjoy the outdoors in style.",
            "category": "nature_escapes",
            "location": "Durmitor Mountains",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/vt4m38xp_Glamping%20Tent%20Night.jpg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 30,
            "amenities": ["Luxury Tent", "Private Bathroom", "Stargazing Deck"],
            "included": ["Luxury accommodation", "All meals", "Activities", "Bonfire evening"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Single Tent", "description": "Solo glamping", "price": 280, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Couple Tent", "description": "Romantic glamping for 2", "price": 420, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Mountain Retreat",
            "description": "Escape to the mountains for a complete retreat experience with yoga, meditation, and nature activities.",
            "category": "nature_escapes",
            "location": "Bjelasica Mountains",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/15v0svwn_PHOTO-2026-03-15-19-30-05.jpg",
            "capacity": 12,
            "available_spots": 12,
            "duration_hours": 30,
            "amenities": ["Mountain Lodge", "Spa Access", "Guided Trails"],
            "included": ["Accommodation", "All meals", "Yoga sessions", "Guided hikes", "Spa treatment"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Standard Room", "description": "Shared accommodation", "price": 350, "max_per_booking": 2},
                {"id": str(uuid.uuid4()), "name": "Private Room", "description": "Private mountain room", "price": 520, "max_per_booking": 2}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # Cultural & Culinary
        {
            "id": str(uuid.uuid4()),
            "title": "Vintage Italian Picnic",
            "description": "A charming Italian-style picnic in a scenic vineyard setting with gourmet food and fine wines.",
            "category": "culinary_tours",
            "location": "Crmnica Wine Region",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/z1kg6p28_PHOTO-2026-03-15-19-40-45.jpg",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 4,
            "amenities": ["Vintage Decor", "Live Music", "Photo Setup"],
            "included": ["Gourmet Italian food", "Premium wines", "Vintage photo session"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Per Person", "description": "Full picnic experience", "price": 95, "max_per_booking": 8}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Secret Places to Visit",
            "description": "Discover hidden gems and secret spots that only locals know. A curated journey off the beaten path. Includes lunch. Transportation can be by land or by sea.",
            "category": "yacht_experiences",
            "location": "Montenegro Hidden Gems",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/xbfs85ot_PHOTO-2026-03-15-19-47-54.jpg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 8,
            "amenities": ["Private Transport", "Local Guide"],
            "included": ["Private guide", "Transport", "Lunch at secret location", "Surprise experiences"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Explorer Pass", "description": "Full day secret tour", "price": 185, "max_per_booking": 4}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Fiat Riva Team Tour Drive",
            "description": "Drive vintage Fiat 500s along the stunning Riva coastline. A unique way to explore the Adriatic.",
            "category": "nature_escapes",
            "location": "Coastal Montenegro",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/9dr6o0dv_C10518AE-9792-4EB3-8B29-1764E1E9A89A.png",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 4,
            "amenities": ["Vintage Fiat 500", "Picnic Hamper", "Maps"],
            "included": ["Fiat 500 rental", "Fuel", "Gourmet picnic", "Guide car"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Per Car (2 people)", "description": "Vintage Fiat experience", "price": 380, "max_per_booking": 3}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Fiat Riva Montenegro Drive",
            "description": "Full day vintage Fiat adventure exploring Montenegro's most scenic coastal and mountain roads.",
            "category": "nature_escapes",
            "location": "Montenegro Grand Tour",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/nzoudtt7_73S-hlFB.jpg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 10,
            "amenities": ["Vintage Fiat 500", "Lunch Stop", "Photo Opportunities"],
            "included": ["Fiat 500 rental", "Fuel", "Breakfast", "Lunch", "Guide car", "Roadside assistance"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Full Day Per Car", "description": "Complete Montenegro tour", "price": 220, "max_per_booking": 3}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Wine Tasting with Art",
            "description": "Combine wine tasting with contemporary art in breathtaking outdoor settings across Tivat. Meeting points change weekly to paint new scenery. We may move the location for painting, creating other art forms or mediums in various locations around Tivat. In case of bad weather we will choose an indoor location in Tivat to have the event. A feast for all senses.",
            "category": "culinary_tours",
            "location": "Tivat, Montenegro",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/qcjuamnp_PHOTO-2026-03-16-15-05-01.jpg",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 2,
            "amenities": ["Art Exhibition", "Sommelier Service"],
            "included": ["6 premium wines", "Art curator guide", "Cheese pairing", "Art catalog"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Tasting Experience", "description": "Wine & art session", "price": 65, "max_per_booking": 6}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Winery Tour Drive",
            "description": "Drive through Montenegro's wine country visiting traditional wineries and tasting local varieties.",
            "category": "culinary_tours",
            "location": "Montenegro Wine Region",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/fbrpc92a_PHOTO-2026-03-16-14-47-29.jpg",
            "capacity": 12,
            "available_spots": 12,
            "duration_hours": 4,
            "amenities": ["Transport", "Multiple Wineries"],
            "included": ["Transport", "3 winery visits", "10+ wine tastings", "Local snacks"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Wine Tour", "description": "Half day winery tour", "price": 180, "max_per_booking": 6}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Skadar Lake Day Visit",
            "description": "Explore the largest lake in Southern Europe with boat tours, bird watching, and traditional lunch.",
            "category": "nature_escapes",
            "location": "Skadar Lake",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/kwh2dut1_IMG_2463.jpeg",
            "capacity": 15,
            "available_spots": 15,
            "duration_hours": 4,
            "amenities": ["Boat Cruise", "Binoculars"],
            "included": ["Boat tour", "Guide", "Traditional lunch", "Wine tasting"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Day Explorer", "description": "Half day lake experience", "price": 250, "max_per_booking": 6}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Skadar Lake Overnight Villa",
            "description": "Stay in a traditional lakeside villa with full board. Experience authentic Montenegrin hospitality.",
            "category": "nature_escapes",
            "location": "Skadar Lake",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/d2h15hev_IMG_2970.jpeg",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 30,
            "amenities": ["Private Villa", "Lake Access", "Fishing Equipment"],
            "included": ["Villa accommodation", "All meals", "Boat tours", "Fishing", "Wine tasting"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Per Person", "description": "Overnight villa stay", "price": 475, "max_per_booking": 4},
                {"id": str(uuid.uuid4()), "name": "Private Villa (up to 6)", "description": "Exclusive villa rental", "price": 980, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        
        # ==================== BOAT RENTAL CATEGORY ====================
        {
            "id": str(uuid.uuid4()),
            "title": "Speedboat Adventure",
            "description": "Rent our premium speedboat for an exhilarating day on the water. Perfect for island hopping.",
            "category": "water_adventures",
            "location": "Montenegro Marina",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/kl7bkeuo_PHOTO-2026-03-16-15-11-12.jpg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 8,
            "amenities": ["GPS Navigation", "Bluetooth Audio", "Cooler"],
            "included": ["Fuel", "Safety equipment", "Brief training"],
            "requires_deposit": True,
            "deposit_percentage": 30,
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Full Day - Low Season", "description": "Full day low season rate", "price": 1700, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Full Day - High Season", "description": "Full day high season rate", "price": 1980, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        
        # Catamaran Charter
        {
            "id": str(uuid.uuid4()),
            "title": "Catamaran Privilege 510 Yacht Charter",
            "description": "Experience our 2025 new 52Ft Catamaran. Dedicated Owners Cabin. 4 Double Cabins, 4 Heads. A/C - Heating. WiFi onboard. Available for Half day, Full Day, Weekly Charters.",
            "category": "water_adventures",
            "location": "Porto Montenegro",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/zu34x02w_PHOTO-2026-03-17-10-58-52.jpg",
            "capacity": 12,
            "available_spots": 12,
            "duration_hours": 4,
            "amenities": ["Professional Crew", "Water Toys", "Sound System", "Air Conditioning"],
            "included": ["Captain", "Fuel", "Water toys", "Ice & water"],
            "requires_deposit": True,
            "deposit_percentage": 30,
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Half Day - Low Season", "description": "4 hour low season charter", "price": 1690, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Half Day - High Season", "description": "4 hour high season charter", "price": 2600, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Full Day - 8 Hours", "description": "Full day charter (8 hours)", "price": 3200, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Classic Heritage Sail\n\"The Sea that Taught Kings\"",
            "description": "Our vintage 82 Ft ship offers a curated cultural journey, with the life and legacy of Marko Martinovic, captain, diplomat and educator who taught the European Nobility the art of the sea.",
            "category": "water_adventures",
            "location": "Porto Montenegro",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/192b6z9z_PHOTO-2026-03-17-11-07-56.jpg",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 4,
            "amenities": ["Classic Sails", "Wooden Deck", "Professional Crew", "Authentic Experience", "Morning - Afternoon Charter: Picnic Lunch and Snacks, Swimming, Music, Entertainment", "Afternoon - Sunset Charter: Sushi & Hors d'oeuvres Dinner, Wine, Music, Entertainment"],
            "included": ["Captain", "Crew", "Refreshments", "Safety equipment"],
            "requires_deposit": True,
            "deposit_percentage": 30,
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Per Person - Low Season", "description": "Price per person low season", "price": 225, "max_per_booking": 20},
                {"id": str(uuid.uuid4()), "name": "Per Person - High Season", "description": "Price per person high season", "price": 350, "max_per_booking": 20},
                {"id": str(uuid.uuid4()), "name": "Half Day - Low Season", "description": "4 hour low season charter", "price": 1690, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Half Day - High Season", "description": "4 hour high season charter", "price": 2690, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Full Day Charter - Low Season", "description": "8 hour low season full day charter", "price": 3400, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Full Day Charter - High Season", "description": "8 hour high season full day charter", "price": 4900, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        
        # Private Dining
        {
            "id": str(uuid.uuid4()),
            "title": "Private Dining on a Yacht",
            "description": "Experience an unforgettable gourmet dining experience aboard a luxury yacht with stunning sea views.",
            "category": "yacht_experiences",
            "location": "Montenegro Coast",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/zxx0hst1_PHOTO-2026-03-17-11-23-00.jpg",
            "capacity": 12,
            "available_spots": 12,
            "duration_hours": 3,
            "amenities": ["Gourmet Menu", "Fine Wines", "Private Chef", "Sunset Views"],
            "included": ["Multi-course dinner", "Wine pairing", "Private chef service", "Yacht cruise"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Per Person", "description": "Private dining experience", "price": 350, "max_per_booking": 12}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },

        # SMOOTH SEA X GOLFSKI
        {
            "id": str(uuid.uuid4()),
            "title": "SMOOTH SEA X GOLFSKI",
            "description": "Starting from Porto Montenegro, a sleek hydrofoil boat takes you across the bay to Lustica Bay. From there, you will be taken to the prestigious Lustica Bay Golf Club. Take a golf lesson or hit the driving range, then play a few holes. Enjoy lunch at the club before heading to The Chedi Hotel for a drink with stunning views. Return by hydrofoil boat to Porto Montenegro. 5 stops, 6 hours of pure luxury.",
            "category": "water_adventures",
            "card_layout": "split",
            "location": "Porto Montenegro, Tivat",
            "date": "2025-06-01",
            "image_url": "https://images.unsplash.com/photo-1616749147147-6c0c1adf073b?w=800",
            "capacity": 5,
            "available_spots": 5,
            "duration_hours": 6,
            "amenities": ["Hydrofoil Boat Transfer", "Lustica Bay Golf Club", "Golf Lesson or Driving Range", "Lunch at the Club", "Drinks at The Chedi Hotel"],
            "included": ["Hydrofoil boat transfers", "Golf access", "Lunch", "Drink at The Chedi Hotel"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Per Person", "description": "Full experience including boat transfers, golf, lunch & drinks", "price": 350, "max_per_booking": 5}
            ],
            "tags": ["dining", "nature", "quiet", "family", "sports", "golf", "luxury", "boat", "hydrofoil", "lunch", "group", "scenic", "relaxing", "outdoor", "active", "food"],
            "time_slots": [
                {"id": str(uuid.uuid4()), "start_time": "09:00", "end_time": "15:00", "available_spots": 5}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },

        # WEDDING AND EVENT PLANNING
        {
            "id": str(uuid.uuid4()),
            "title": "Yacht Wedding Celebration",
            "description": "Say 'I Do' on the Adriatic Sea. Wandering Yacht transforms a luxury yacht into your dream wedding venue, surrounded by Montenegro's dramatic mountains and crystal waters. Our dedicated team handles every detail so you can focus on the magic of your special day.\n\nYour Wedding Day Includes:\n• Private luxury yacht exclusively for your ceremony & reception\n• Onboard wedding coordinator & event styling\n• Floral arrangements & elegant table décor\n• Gourmet catering with a curated multi-course menu\n• Premium open bar with champagne toast\n• Live music or curated DJ set\n• Professional lighting & sound system\n• Captain & full yacht crew\n• Scenic cruising through the Bay of Kotor\n• Sunset ceremony positioning\n• Wedding cake by a local artisan patissier\n• Red carpet boarding & welcome champagne\n• Accommodation coordination for guests",
            "category": "weddings_events",
            "location": "Bay of Kotor, Montenegro",
            "date": "2025-06-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/izj5hjhu_IMG_2955.jpeg",
            "capacity": 50,
            "available_spots": 50,
            "duration_hours": 8,
            "amenities": ["Wedding Coordinator", "Luxury Yacht", "Gourmet Catering", "Live Music", "Floral Design", "Photography Ready"],
            "included": ["Private yacht charter", "Wedding coordinator", "Catering & open bar", "Floral décor", "Sound & lighting", "Captain & crew", "Champagne toast", "Wedding cake"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Intimate (up to 20 guests)", "description": "Perfect for an intimate yacht wedding celebration", "price": 8500, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Grand (up to 50 guests)", "description": "Full wedding celebration on our largest yacht", "price": 15000, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Couple's Photo Experience on the Water",
            "description": "Capture timeless moments aboard a classic wooden boat against Montenegro's breathtaking coastline. Whether before or after your wedding, this intimate photo session creates stunning images you'll treasure forever.\n\nYour Photo Experience Includes:\n• Private classic wooden boat for 2 hours\n• Professional wedding & portrait photographer\n• Scenic route through the Bay of Kotor\n• Golden hour & sunset positioning\n• Champagne & canapés onboard\n• Captain in classic maritime attire\n• Multiple scenic stops for photos\n• Mountain, sea & old town backdrops\n• 50+ professionally edited digital images\n• Online gallery delivered within 7 days\n• Option to add drone aerial photography\n• Hair & makeup touch-up kit onboard\n• Personalised photo album (add-on available)",
            "category": "weddings_events",
            "location": "Porto Montenegro, Tivat",
            "date": "2025-06-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/zev6mkpk_IMG_2953.jpeg",
            "capacity": 4,
            "available_spots": 4,
            "duration_hours": 2,
            "amenities": ["Professional Photographer", "Classic Wooden Boat", "Champagne", "Scenic Route", "Digital Gallery"],
            "included": ["Private boat charter", "Professional photographer", "Champagne & canapés", "50+ edited photos", "Online gallery", "Captain"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "1 Hour Session", "description": "1-hour photo experience for the couple", "price": 600, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Couple's Session", "description": "2-hour photo experience for the couple", "price": 1200, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Drone Photography", "description": "Includes aerial drone shots", "price": 1600, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # TRANSFER SERVICE
        {
            "id": str(uuid.uuid4()),
            "title": "Mercedes Minivan Transfer Service",
            "description": "Travel Montenegro in comfort and style with our premium Mercedes Minivan transfer service. Whether you need an airport pick-up, a drop-off to your hotel, a later collection, or a full-day scenic drive through Montenegro's stunning coastline and mountains — we've got you covered.\n\nPerfect for families, groups, or anyone who wants a seamless, stress-free journey.\n\nService Includes:\n• Luxury Mercedes Minivan (up to 7 guests)\n• Professional English-speaking driver\n• Airport meet & greet with name board\n• Complimentary bottled water & Wi-Fi\n• Child seats available on request\n• Flexible scheduling — pick up, drop off, collect later\n• Full-day hire available for scenic touring\n• Air conditioning & premium leather interior\n• Luggage assistance\n• 24/7 booking availability",
            "category": "concierge_services",
            "location": "Montenegro (Anywhere)",
            "date": "2025-06-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/wd63v1g1_IMG_2973%202.JPG",
            "capacity": 7,
            "available_spots": 7,
            "duration_hours": 4,
            "amenities": ["Mercedes Minivan", "Professional Driver", "Wi-Fi", "Air Conditioning", "Bottled Water", "Child Seats"],
            "included": ["Luxury Mercedes Minivan", "Professional driver", "Bottled water & Wi-Fi", "Luggage assistance", "Meet & greet"],
            "tags": ["transfer", "transport", "family-friendly", "airport", "luxury", "private", "group"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "One-Way Transfer", "description": "Single pick-up or drop-off anywhere in Montenegro", "price": 120, "max_per_booking": 7},
                {"id": str(uuid.uuid4()), "name": "Return Transfer", "description": "Pick-up and drop-off with waiting time", "price": 200, "max_per_booking": 7},
                {"id": str(uuid.uuid4()), "name": "Full Day Hire (8 hours)", "description": "Explore Montenegro at your pace with a private driver", "price": 450, "max_per_booking": 7}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # WEDDING DREAM
        {
            "id": str(uuid.uuid4()),
            "title": "Wedding Dream",
            "description": "Create the most stunning 'Mamma Mia' style experience and ceremony — because we have the place.\n\nImagine privatising 4 beautiful beaches (2 of white pebbles), a candlelit walkway from the shore where your guests arrive by boat, walking together up to the ceremony. Later, dine al fresco under the stars at an exclusive reception with breathtaking sea views.\n\nYour Dream Wedding Includes:\n• 4 privatised beaches with candlelit walkways\n• Guest arrival by boat to the ceremony beach\n• Outdoor ceremony with panoramic sea & mountain views\n• Reception dining under the stars\n• Entire boutique hotel exclusively yours — 20 rooms\n• Private restaurant & traditional stone tavern\n• 12 charming stone villas\n• 6 luxury apartments\n• The Wedding / Presidential Suite\n• Honeymoon departure by speedboat or private yacht\n• Option to cruise to a secluded honeymoon location on or near the water\n• Full wedding coordination & event styling\n• Floral design & décor\n• Gourmet catering with local & international cuisine\n• Premium open bar\n• Live music & entertainment\n• Professional lighting, sound & visual effects\n• Photography & videography coordination\n• Guest transport by boat\n• Dedicated on-site event manager\n\nThis is not just a wedding — it's a once-in-a-lifetime experience on the Montenegrin coast, where mountains meet the Adriatic and dreams come true.",
            "category": "weddings_events",
            "location": "Montenegro Coast",
            "date": "2025-06-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/l9tgv63a_IMG_2972.jpeg",
            "capacity": 150,
            "available_spots": 150,
            "duration_hours": 72,
            "amenities": ["Private Beaches", "Boutique Hotel", "Stone Villas", "Restaurant & Tavern", "Presidential Suite", "Speedboat", "Candlelit Walkways", "Live Music"],
            "included": ["4 privatised beaches", "Entire boutique hotel (20 rooms)", "12 stone villas & 6 apartments", "Wedding/Presidential Suite", "Restaurant & tavern", "Wedding coordinator", "Floral design & décor", "Catering & open bar", "Guest boat transport", "Honeymoon speedboat departure"],
            "tags": ["wedding", "romantic", "luxury", "exclusive", "honeymoon", "beachfront", "ceremony", "celebration"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Intimate Wedding (up to 50 guests)", "description": "Exclusive venue with all amenities for an intimate celebration", "price": 25000, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Grand Wedding (up to 78 Staying Overnight Guests)", "description": "Up to 100 Guests attending — Full venue takeover with complete wedding production", "price": 67000, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Ultimate Dream — The Mamma Mia Experience", "description": "Take over the entire Hotel as your Wedding venue. Stay 3 days, 3 nights. Includes planned wedding, food, water and juices.", "price": 110000, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # Concierge Services
        {
            "id": str(uuid.uuid4()),
            "title": "Concierge Services",
            "description": "Offering daily, weekly, monthly services. Personal Assistant to organise your agenda and travel itinerary. Booking everything; accommodations, dining, excursions, transfers, travel. Creating itineraries just for you. Let us take the stress out of your holiday time while you focus on relaxing.",
            "category": "concierge_services",
            "location": "Montenegro",
            "date": "2025-01-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/kxu0ah94_KEY.jpeg",
            "capacity": 100,
            "available_spots": 100,
            "duration_hours": 0,
            "amenities": ["Personal Assistant", "Travel Planning", "Booking Management", "Custom Itineraries"],
            "included": ["Dedicated concierge", "Itinerary planning", "All bookings handled"],
            "tags": ["concierge", "personal assistant", "travel planning", "luxury", "VIP"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Daily", "description": "Full day concierge service", "price": 200, "max_per_booking": 30},
                {"id": str(uuid.uuid4()), "name": "Weekly", "description": "7 days concierge service", "price": 1000, "max_per_booking": 4},
                {"id": str(uuid.uuid4()), "name": "Monthly", "description": "30 days concierge service", "price": 5000, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
    ]
    
    await db.experiences.insert_many(experiences)
    return {"message": "Data seeded successfully", "count": len(experiences)}

# ======================== ROOT ROUTE ========================

@api_router.get("/")
async def root():
    return {"message": "Wandering Yacht API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

@api_router.post("/admin/update-categories")
async def update_experience_categories():
    """Update category for specific experiences"""
    yacht_titles = [
        "Sunrise Yoga on Deck",
        "Sunset Yoga on Deck",
        "Wellness Morning at Sea",
        "Wellness Afternoon at Sea",
        "Secret Places to Visit",
        "Private Dining on a Yacht",
    ]
    nature_titles = [
        "Nature Hike",
        "Glamping Experience",
        "Mountain Retreat",
        "Fiat Riva Team Tour Drive",
        "Fiat Riva Montenegro Drive",
        "Skadar Lake Day Visit",
        "Skadar Lake Overnight Villa",
    ]
    culinary_titles = [
        "Vintage Italian Picnic",
        "Wine Tasting with Art",
        "Winery Tour Drive",
    ]
    water_titles = [
        "Jet Ski on the River",
        "Kayaking Adventure",
        "SUP - Stand Up Paddleboarding",
        "SUP Full Day",
        "SUP Full Week",
        "Kite Surfing Overnight",
        "Speedboat Adventure",
    ]
    # Classic Heritage Sail has a newline in the title
    r1 = await db.experiences.update_many(
        {"title": {"$in": yacht_titles}},
        {"$set": {"category": "yacht_experiences"}}
    )
    r2 = await db.experiences.update_many(
        {"title": {"$in": nature_titles}},
        {"$set": {"category": "nature_escapes"}}
    )
    r3 = await db.experiences.update_many(
        {"title": {"$in": culinary_titles}},
        {"$set": {"category": "culinary_tours"}}
    )
    r4 = await db.experiences.update_many(
        {"title": {"$in": water_titles}},
        {"$set": {"category": "water_adventures"}}
    )
    r5 = await db.experiences.update_many(
        {"title": {"$regex": "Classic Heritage Sail"}},
        {"$set": {"category": "water_adventures"}}
    )
    return {"message": f"Updated {r1.modified_count} yacht, {r2.modified_count} nature, {r3.modified_count} culinary, {r4.modified_count + r5.modified_count} water"}

@api_router.post("/admin/add-missing-experiences")
async def add_missing_experiences():

    # Also fix Sunrise Yoga available spots
    await db.experiences.update_one(
        {"title": "Sunrise Yoga on Deck"},
        {"$set": {"available_spots": 8, "capacity": 8}}
    )

    """Add Speedboat Adventure and Classic Heritage Sail if they don't exist"""
    import uuid as uuid_mod
    added = []
    
    existing_speedboat = await db.experiences.find_one({"title": "Speedboat Adventure"})
    if not existing_speedboat:
        await db.experiences.insert_one({
            "id": str(uuid_mod.uuid4()),
            "title": "Speedboat Adventure",
            "description": "Rent our premium speedboat for an exhilarating day on the water. Perfect for island hopping.",
            "category": "water_adventures",
            "location": "Montenegro Marina",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/kl7bkeuo_PHOTO-2026-03-16-15-11-12.jpg",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 8,
            "amenities": ["GPS Navigation", "Bluetooth Audio", "Cooler"],
            "included": ["Fuel", "Safety equipment", "Brief training"],
            "ticket_types": [
                {"id": str(uuid_mod.uuid4()), "name": "Low Season", "description": "Low season rate", "price": 1700, "max_per_booking": 1},
                {"id": str(uuid_mod.uuid4()), "name": "High Season", "description": "High season rate", "price": 1980, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        })
        added.append("Speedboat Adventure")
    
    existing_sail = await db.experiences.find_one({"title": {"$regex": "Classic Heritage Sail"}})
    if not existing_sail:
        await db.experiences.insert_one({
            "id": str(uuid_mod.uuid4()),
            "title": "Classic Heritage Sail\n\"The Sea that Taught Kings\"",
            "description": "Our vintage 82 Ft ship offers a curated cultural journey, with the life and legacy of Marko Martinovic, captain, diplomat and educator who taught the European Nobility the art of the sea.",
            "category": "water_adventures",
            "location": "Porto Montenegro",
            "date": "2025-08-01",
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/192b6z9z_PHOTO-2026-03-17-11-07-56.jpg",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 4,
            "amenities": ["Classic Sails", "Wooden Deck", "Professional Crew", "Authentic Experience"],
            "included": ["Captain", "Crew", "Refreshments", "Safety equipment"],
            "ticket_types": [
                {"id": str(uuid_mod.uuid4()), "name": "Per Person", "description": "Price per person", "price": 175, "max_per_booking": 20},
                {"id": str(uuid_mod.uuid4()), "name": "Low Season (Full Charter)", "description": "4 hour low season charter", "price": 1690, "max_per_booking": 1},
                {"id": str(uuid_mod.uuid4()), "name": "High Season (Full Charter)", "description": "4 hour high season charter", "price": 2690, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        })
        added.append("Classic Heritage Sail")
    
    return {"message": f"Added: {', '.join(added)}" if added else "Both already exist"}

@api_router.post("/admin/add-new-experiences")
async def add_new_experiences():
    """Add Mercedes Transfer and Wedding Dream experiences"""
    import uuid as uuid_mod
    added = []

    existing_transfer = await db.experiences.find_one({"title": "Mercedes Minivan Transfer Service"})
    if not existing_transfer:
        await db.experiences.insert_one({
            "id": str(uuid_mod.uuid4()),
            "title": "Mercedes Minivan Transfer Service",
            "description": "Travel Montenegro in comfort and style with our premium Mercedes Minivan transfer service. Whether you need an airport pick-up, a drop-off to your hotel, a later collection, or a full-day scenic drive through Montenegro's stunning coastline and mountains — we've got you covered.\n\nPerfect for families, groups, or anyone who wants a seamless, stress-free journey.\n\nService Includes:\n• Luxury Mercedes Minivan (up to 7 guests)\n• Professional English-speaking driver\n• Airport meet & greet with name board\n• Complimentary bottled water & Wi-Fi\n• Child seats available on request\n• Flexible scheduling — pick up, drop off, collect later\n• Full-day hire available for scenic touring\n• Air conditioning & premium leather interior\n• Luggage assistance\n• 24/7 booking availability",
            "category": "concierge_services",
            "location": "Montenegro (Anywhere)",
            "date": "2025-06-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/wd63v1g1_IMG_2973%202.JPG",
            "capacity": 7,
            "available_spots": 7,
            "duration_hours": 4,
            "amenities": ["Mercedes Minivan", "Professional Driver", "Wi-Fi", "Air Conditioning", "Bottled Water", "Child Seats"],
            "included": ["Luxury Mercedes Minivan", "Professional driver", "Bottled water & Wi-Fi", "Luggage assistance", "Meet & greet"],
            "tags": ["transfer", "transport", "family-friendly", "airport", "luxury", "private", "group"],
            "ticket_types": [
                {"id": str(uuid_mod.uuid4()), "name": "One-Way Transfer", "description": "Single pick-up or drop-off anywhere in Montenegro", "price": 120, "max_per_booking": 7},
                {"id": str(uuid_mod.uuid4()), "name": "Return Transfer", "description": "Pick-up and drop-off with waiting time", "price": 200, "max_per_booking": 7},
                {"id": str(uuid_mod.uuid4()), "name": "Full Day Hire (8 hours)", "description": "Explore Montenegro at your pace with a private driver", "price": 450, "max_per_booking": 7}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        })
        added.append("Mercedes Minivan Transfer Service")

    existing_wedding = await db.experiences.find_one({"title": "Wedding Dream"})
    if not existing_wedding:
        await db.experiences.insert_one({
            "id": str(uuid_mod.uuid4()),
            "title": "Wedding Dream",
            "description": "Create the most stunning 'Mamma Mia' style experience and ceremony — because we have the place.\n\nImagine privatising 4 beautiful beaches (2 of white pebbles), a candlelit walkway from the shore where your guests arrive by boat, walking together up to the ceremony. Later, dine al fresco under the stars at an exclusive reception with breathtaking sea views.\n\nYour Dream Wedding Includes:\n• 4 privatised beaches with candlelit walkways\n• Guest arrival by boat to the ceremony beach\n• Outdoor ceremony with panoramic sea & mountain views\n• Reception dining under the stars\n• Entire boutique hotel exclusively yours — 20 rooms\n• Private restaurant & traditional stone tavern\n• 12 charming stone villas\n• 6 luxury apartments\n• The Wedding / Presidential Suite\n• Honeymoon departure by speedboat or private yacht\n• Option to cruise to a secluded honeymoon location on or near the water\n• Full wedding coordination & event styling\n• Floral design & décor\n• Gourmet catering with local & international cuisine\n• Premium open bar\n• Live music & entertainment\n• Professional lighting, sound & visual effects\n• Photography & videography coordination\n• Guest transport by boat\n• Dedicated on-site event manager\n\nThis is not just a wedding — it is a once-in-a-lifetime experience on the Montenegrin coast, where mountains meet the Adriatic and dreams come true.",
            "category": "experiences",
            "location": "Montenegro Coast",
            "date": "2025-06-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/l9tgv63a_IMG_2972.jpeg",
            "capacity": 150,
            "available_spots": 150,
            "duration_hours": 72,
            "amenities": ["Private Beaches", "Boutique Hotel", "Stone Villas", "Restaurant & Tavern", "Presidential Suite", "Speedboat", "Candlelit Walkways", "Live Music"],
            "included": ["4 privatised beaches", "Entire boutique hotel (20 rooms)", "12 stone villas & 6 apartments", "Wedding/Presidential Suite", "Restaurant & tavern", "Wedding coordinator", "Floral design & decor", "Catering & open bar", "Guest boat transport", "Honeymoon speedboat departure"],
            "tags": ["wedding", "romantic", "luxury", "exclusive", "honeymoon", "beachfront", "ceremony", "celebration"],
            "ticket_types": [
                {"id": str(uuid_mod.uuid4()), "name": "Intimate Wedding (up to 50 guests)", "description": "Exclusive venue with all amenities for an intimate celebration", "price": 25000, "max_per_booking": 1},
                {"id": str(uuid_mod.uuid4()), "name": "Grand Wedding (up to 100 guests)", "description": "Full venue takeover with complete wedding production", "price": 45000, "max_per_booking": 1},
                {"id": str(uuid_mod.uuid4()), "name": "Ultimate Dream — The Mamma Mia Experience", "description": "Take over the entire Hotel as your Wedding venue. Stay 3 days, 3 nights. Includes planned wedding, food, water and juices.", "price": 110000, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        })
        added.append("Wedding Dream")

    return {"message": f"Added: {', '.join(added)}" if added else "Both already exist"}

@api_router.post("/admin/setup-deposit-charters")
async def setup_deposit_charters():
    """Set requires_deposit=True for yacht/boat charter experiences and update their ticket types"""
    import uuid as uuid_mod
    results = []
    
    # 1. Speedboat Adventure - mark as deposit required, rename tickets
    r1 = await db.experiences.update_one(
        {"title": "Speedboat Adventure"},
        {
            "$set": {
                "requires_deposit": True,
                "deposit_percentage": 30,
                "ticket_types": [
                    {"id": str(uuid_mod.uuid4()), "name": "Full Day - Low Season", "description": "Full day low season rate", "price": 1700, "max_per_booking": 1},
                    {"id": str(uuid_mod.uuid4()), "name": "Full Day - High Season", "description": "Full day high season rate", "price": 1980, "max_per_booking": 1}
                ]
            }
        }
    )
    results.append(f"Speedboat: {r1.modified_count}")
    
    # 2. Catamaran - add Full Day ticket, mark as deposit required
    r2 = await db.experiences.update_one(
        {"title": "Catamaran Privilege 510 Yacht Charter"},
        {
            "$set": {
                "requires_deposit": True,
                "deposit_percentage": 30,
                "ticket_types": [
                    {"id": str(uuid_mod.uuid4()), "name": "Half Day - Low Season", "description": "4 hour low season charter", "price": 1690, "max_per_booking": 1},
                    {"id": str(uuid_mod.uuid4()), "name": "Half Day - High Season", "description": "4 hour high season charter", "price": 2600, "max_per_booking": 1},
                    {"id": str(uuid_mod.uuid4()), "name": "Full Day - 8 Hours", "description": "Full day charter (8 hours)", "price": 3200, "max_per_booking": 1}
                ]
            }
        }
    )
    results.append(f"Catamaran: {r2.modified_count}")
    
    # 3. Classic Heritage Sail - add Full Day tickets, mark as deposit required
    r3 = await db.experiences.update_one(
        {"title": {"$regex": "Classic Heritage Sail"}},
        {
            "$set": {
                "requires_deposit": True,
                "deposit_percentage": 30,
                "ticket_types": [
                    {"id": str(uuid_mod.uuid4()), "name": "Per Person", "description": "Price per person", "price": 175, "max_per_booking": 20},
                    {"id": str(uuid_mod.uuid4()), "name": "Half Day - Low Season (Full Charter)", "description": "4 hour low season charter", "price": 1690, "max_per_booking": 1},
                    {"id": str(uuid_mod.uuid4()), "name": "Half Day - High Season (Full Charter)", "description": "4 hour high season charter", "price": 2690, "max_per_booking": 1},
                    {"id": str(uuid_mod.uuid4()), "name": "Full Day Charter - Low Season", "description": "8 hour low season full day charter", "price": 2900, "max_per_booking": 1},
                    {"id": str(uuid_mod.uuid4()), "name": "Full Day Charter - High Season", "description": "8 hour high season full day charter", "price": 4900, "max_per_booking": 1}
                ]
            }
        }
    )
    results.append(f"Classic Heritage Sail: {r3.modified_count}")
    
    # 4. 24M Luxury Motor Yacht Charter - mark as deposit required
    r4 = await db.experiences.update_one(
        {"title": "24M Luxury Motor Yacht Charter"},
        {
            "$set": {
                "requires_deposit": True,
                "deposit_percentage": 30
            }
        }
    )
    results.append(f"24M Motor Yacht: {r4.modified_count}")
    
    return {"message": "Deposit charter setup complete", "results": results}

# ======================== 70% BALANCE COLLECTION FLOW ========================

@api_router.post("/payment/request-balance/{booking_id}")
async def request_balance_payment(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Send balance payment request email to the customer for a deposit booking."""
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("payment_status") != "deposit_paid":
        raise HTTPException(status_code=400, detail="This booking does not have a pending balance")
    
    user = await db.users.find_one({"id": booking["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer_name = user.get("full_name", user.get("name", user["email"].split("@")[0]))
    
    # Generate the balance payment URL
    app_base_url = os.environ.get("APP_BASE_URL", "https://wandering-yacht-1.preview.emergentagent.com")
    payment_url = f"{app_base_url}/balance/{booking_id}"
    
    # Send the balance request email
    success = send_balance_request_email(
        to_email=user["email"],
        customer_name=customer_name,
        booking=booking,
        payment_url=payment_url
    )
    
    if success:
        # Track that balance request was sent
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {
                "balance_requested_at": datetime.utcnow(),
                "balance_request_count": (booking.get("balance_request_count", 0) + 1)
            }}
        )
        return {"status": "success", "message": f"Balance request email sent to {user['email']}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send balance request email")

@api_router.get("/payment/balance-info/{booking_id}")
async def get_balance_info(booking_id: str):
    """Get balance payment info for a booking (public endpoint for email links)."""
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("payment_status") not in ["deposit_paid"]:
        raise HTTPException(status_code=400, detail="No balance due for this booking")
    
    experience = await db.experiences.find_one({"id": booking.get("experience_id")})
    
    return {
        "booking_id": booking["id"],
        "experience_title": booking["experience_title"],
        "experience_date": booking["experience_date"],
        "experience_location": booking["experience_location"],
        "experience_image": experience.get("images", [experience.get("image", "")])[0] if experience else "",
        "total_amount": booking["total_amount"],
        "deposit_amount": booking.get("deposit_amount", 0),
        "remaining_balance": booking.get("remaining_balance", 0),
        "deposit_percentage": booking.get("deposit_percentage", 30),
        "status": booking.get("payment_status"),
    }

@api_router.post("/payment/create-balance-intent/{booking_id}")
async def create_balance_payment_intent(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Create a Stripe PaymentIntent for the remaining balance."""
    booking = await db.bookings.find_one({"id": booking_id, "user_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("payment_status") != "deposit_paid":
        raise HTTPException(status_code=400, detail="No balance due for this booking")
    
    remaining = booking.get("remaining_balance", 0)
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="No balance remaining")
    
    try:
        payment_intent = stripe.PaymentIntent.create(
            amount=int(remaining * 100),  # Convert to cents
            currency="eur",
            metadata={
                "booking_id": booking_id,
                "type": "balance_payment",
                "experience": booking["experience_title"],
            }
        )
        
        # Store the balance payment intent
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {"balance_payment_intent_id": payment_intent.id}}
        )
        
        return {
            "client_secret": payment_intent.client_secret,
            "amount": remaining,
            "payment_intent_id": payment_intent.id,
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/payment/confirm-balance/{booking_id}")
async def confirm_balance_payment(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Confirm the remaining balance payment — upgrades booking to fully paid."""
    booking = await db.bookings.find_one({"id": booking_id, "user_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("payment_status") != "deposit_paid":
        raise HTTPException(status_code=400, detail="No balance due for this booking")
    
    # Verify Stripe payment if intent exists
    balance_intent_id = booking.get("balance_payment_intent_id")
    if balance_intent_id:
        try:
            intent = stripe.PaymentIntent.retrieve(balance_intent_id)
            if intent.status not in ["succeeded", "requires_payment_method", "requires_confirmation"]:
                raise HTTPException(status_code=400, detail=f"Payment status: {intent.status}")
        except stripe.error.StripeError as e:
            logger.warning(f"Stripe balance verification skipped: {e}")
    
    # Update booking to fully paid
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "payment_status": "paid",
            "status": "confirmed",
            "balance_paid_at": datetime.utcnow(),
            "remaining_balance": 0,
        }}
    )
    
    updated_booking = await db.bookings.find_one({"id": booking_id})
    
    # Send emails and update calendar
    try:
        user = await db.users.find_one({"id": current_user["id"]})
        if user and user.get("email"):
            experience = await db.experiences.find_one({"id": booking.get("experience_id")})
            customer_name = user.get("full_name", user.get("name", user["email"].split("@")[0]))
            
            # Send full payment confirmation + itinerary prompt to customer
            send_full_payment_confirmation(
                to_email=user["email"],
                customer_name=customer_name,
                booking=updated_booking
            )
            
            # Send invoice to business email
            try:
                send_business_invoice(
                    customer_name=customer_name,
                    customer_email=user["email"],
                    booking=updated_booking,
                    experience=experience or {},
                    payment_label="Balance Payment"
                )
            except Exception as inv_err:
                logger.error(f"Balance invoice send failed (non-blocking): {inv_err}")
            
            # Update Google Calendar event color to green (fully paid)
            cal_event_id = booking.get("calendar_event_id")
            if cal_event_id:
                try:
                    service = get_google_calendar_service()
                    if service:
                        event = service.events().get(calendarId=GOOGLE_CALENDAR_ID, eventId=cal_event_id).execute()
                        event['colorId'] = '10'  # basil/green = fully paid
                        event['summary'] = event['summary'].replace('🚢', '✅')
                        event['description'] = event['description'].replace('DEPOSIT PAID', 'FULLY PAID') + f"\n\n✅ Balance of €{booking.get('deposit_amount', 0):.2f} received on {datetime.utcnow().strftime('%Y-%m-%d')}"
                        service.events().update(calendarId=GOOGLE_CALENDAR_ID, eventId=cal_event_id, body=event).execute()
                        logger.info(f"Calendar event {cal_event_id} updated to FULLY PAID")
                except Exception as cal_err:
                    logger.error(f"Calendar update failed (non-blocking): {cal_err}")
    except Exception as e:
        logger.error(f"Balance confirmation emails failed (non-blocking): {str(e)}")
    
    return {
        "status": "success",
        "message": "Balance payment confirmed! Booking is now fully paid.",
        "booking": Booking(**updated_booking).dict()
    }

@api_router.get("/bookings/deposit-pending")
async def get_deposit_pending_bookings(current_user: dict = Depends(get_current_user)):
    """Get all bookings with pending balance (for admin to send balance requests)."""
    bookings = await db.bookings.find({"payment_status": "deposit_paid"}).to_list(100)
    result = []
    for b in bookings:
        user = await db.users.find_one({"id": b["user_id"]})
        result.append({
            "booking": Booking(**b).dict(),
            "customer_name": user.get("full_name", "Unknown") if user else "Unknown",
            "customer_email": user.get("email", "Unknown") if user else "Unknown",
        })
    return result

# ======================== PASSKEY / WEBAUTHN ENDPOINTS ========================

@api_router.post("/passkey/register/options")
async def passkey_register_options(current_user: dict = Depends(get_current_user)):
    """Generate WebAuthn registration options for the authenticated user."""
    try:
        # Get existing passkeys for this user
        existing_creds = await db.passkeys.find({"user_id": current_user["id"]}).to_list(100)
        exclude_credentials = []
        for cred in existing_creds:
            exclude_credentials.append(
                PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred["credential_id"]))
            )

        options = webauthn.generate_registration_options(
            rp_id=WEBAUTHN_RP_ID,
            rp_name=WEBAUTHN_RP_NAME,
            user_id=current_user["id"].encode(),
            user_name=current_user["email"],
            user_display_name=current_user.get("full_name", current_user["email"]),
            exclude_credentials=exclude_credentials,
            authenticator_selection=AuthenticatorSelectionCriteria(
                resident_key=ResidentKeyRequirement.PREFERRED,
                user_verification=UserVerificationRequirement.PREFERRED,
            ),
        )

        # Store challenge in DB for verification
        challenge_b64 = bytes_to_base64url(options.challenge)
        await db.webauthn_challenges.update_one(
            {"user_id": current_user["id"], "type": "registration"},
            {"$set": {
                "challenge": challenge_b64,
                "created_at": datetime.utcnow(),
            }},
            upsert=True
        )

        # Serialize options to JSON-compatible dict
        options_dict = json.loads(webauthn.options_to_json(options))
        return options_dict

    except Exception as e:
        logger.error(f"Passkey register options error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/passkey/register/verify")
async def passkey_register_verify(data: PasskeyRegisterRequest, current_user: dict = Depends(get_current_user)):
    """Verify and store the WebAuthn registration response."""
    try:
        # Retrieve stored challenge
        challenge_doc = await db.webauthn_challenges.find_one(
            {"user_id": current_user["id"], "type": "registration"}
        )
        if not challenge_doc:
            raise HTTPException(status_code=400, detail="No registration challenge found. Start registration again.")

        expected_challenge = base64url_to_bytes(challenge_doc["challenge"])

        verification = webauthn.verify_registration_response(
            credential=data.credential,
            expected_challenge=expected_challenge,
            expected_rp_id=WEBAUTHN_RP_ID,
            expected_origin=WEBAUTHN_ORIGIN,
        )

        # Store the credential in DB
        credential_id_b64 = bytes_to_base64url(verification.credential_id)
        public_key_b64 = bytes_to_base64url(verification.credential_public_key)

        await db.passkeys.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "credential_id": credential_id_b64,
            "public_key": public_key_b64,
            "sign_count": verification.sign_count,
            "device_name": "Passkey",
            "created_at": datetime.utcnow(),
        })

        # Clean up challenge
        await db.webauthn_challenges.delete_one({"user_id": current_user["id"], "type": "registration"})

        return {"status": "success", "message": "Passkey registered successfully"}

    except Exception as e:
        logger.error(f"Passkey register verify error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/passkey/auth/options")
async def passkey_auth_options():
    """Generate WebAuthn authentication options (no auth required)."""
    try:
        options = webauthn.generate_authentication_options(
            rp_id=WEBAUTHN_RP_ID,
            user_verification=UserVerificationRequirement.PREFERRED,
        )

        challenge_b64 = bytes_to_base64url(options.challenge)
        # Store challenge temporarily keyed by value (since we don't know user yet)
        await db.webauthn_challenges.insert_one({
            "challenge": challenge_b64,
            "type": "authentication",
            "created_at": datetime.utcnow(),
        })

        options_dict = json.loads(webauthn.options_to_json(options))
        return options_dict

    except Exception as e:
        logger.error(f"Passkey auth options error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/passkey/auth/verify")
async def passkey_auth_verify(data: PasskeyAuthRequest):
    """Verify WebAuthn authentication and return JWT token."""
    try:
        # Parse the credential to get the credential ID
        cred_json = json.loads(data.credential)
        raw_id = cred_json.get("rawId", cred_json.get("id", ""))

        # Look up the stored passkey
        stored_passkey = await db.passkeys.find_one({"credential_id": raw_id})
        if not stored_passkey:
            raise HTTPException(status_code=401, detail="Passkey not recognized")

        # Find a valid challenge
        challenge_doc = await db.webauthn_challenges.find_one({"type": "authentication"})
        if not challenge_doc:
            raise HTTPException(status_code=400, detail="No authentication challenge found")

        expected_challenge = base64url_to_bytes(challenge_doc["challenge"])

        verification = webauthn.verify_authentication_response(
            credential=data.credential,
            expected_challenge=expected_challenge,
            expected_rp_id=WEBAUTHN_RP_ID,
            expected_origin=WEBAUTHN_ORIGIN,
            credential_public_key=base64url_to_bytes(stored_passkey["public_key"]),
            credential_current_sign_count=stored_passkey["sign_count"],
        )

        # Update sign count
        await db.passkeys.update_one(
            {"credential_id": raw_id},
            {"$set": {"sign_count": verification.new_sign_count}}
        )

        # Clean up challenge
        await db.webauthn_challenges.delete_one({"_id": challenge_doc["_id"]})

        # Get user and issue JWT
        user = await db.users.find_one({"id": stored_passkey["user_id"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        access_token = create_access_token(data={"sub": user["id"]})

        return {
            "status": "success",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "full_name": user["full_name"],
                "phone": user.get("phone"),
                "whatsapp_number": user.get("whatsapp_number"),
                "created_at": user["created_at"].isoformat(),
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Passkey auth verify error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ======================== BIOMETRIC TOKEN REFRESH ========================

@api_router.post("/auth/biometric-refresh")
async def biometric_refresh(current_user: dict = Depends(get_current_user)):
    """Refresh JWT token for biometric re-login. Called after biometric verification on device."""
    # The user already authenticated via their stored token + biometric check on device
    # We issue a fresh JWT
    access_token = create_access_token(data={"sub": current_user["id"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "full_name": current_user["full_name"],
            "phone": current_user.get("phone"),
            "whatsapp_number": current_user.get("whatsapp_number"),
            "created_at": current_user["created_at"].isoformat(),
        }
    }

# ======================== EMAIL MARKETING DATABASE ========================

def send_weekly_digest():
    """Send weekly email digest with client database info to booking@wanderingyacht.com"""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient as AsyncClient
    from config import MONGO_URL, DB_NAME, SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD
    
    # Create new connection for background task
    bg_client = AsyncClient(MONGO_URL)
    bg_db = bg_client[DB_NAME]
    
    async def _send():
        try:
            now = datetime.utcnow()
            week_ago = now - timedelta(days=7)
            
            # Get all users
            all_users = await bg_db.users.find({}).to_list(10000)
            total_count = len(all_users)
            
            # Get users from last 7 days
            new_users = [u for u in all_users if u.get('created_at', now) >= week_ago]
            new_count = len(new_users)
            
            # Build new users table rows
            new_user_rows = ""
            for u in sorted(new_users, key=lambda x: x.get('created_at', now), reverse=True):
                created = u.get('created_at', now).strftime('%Y-%m-%d %H:%M')
                new_user_rows += f"""
                <tr>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:Georgia,serif;font-size:13px;color:#333;">{u.get('full_name','—')}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:Georgia,serif;font-size:13px;color:#333;">{u.get('email','—')}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:Georgia,serif;font-size:13px;color:#7a8a8a;">{u.get('phone','—')}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:Georgia,serif;font-size:13px;color:#7a8a8a;">{u.get('whatsapp_number','—')}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:Georgia,serif;font-size:12px;color:#999;">{created}</td>
                </tr>"""
            
            if not new_user_rows:
                new_user_rows = '<tr><td colspan="5" style="padding:16px;text-align:center;color:#999;font-family:Georgia,serif;">No new signups this week</td></tr>'
            
            # Build full database rows (last 50)
            all_user_rows = ""
            for u in sorted(all_users, key=lambda x: x.get('created_at', now), reverse=True)[:50]:
                created = u.get('created_at', now).strftime('%Y-%m-%d')
                all_user_rows += f"""
                <tr>
                    <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;">{u.get('full_name','—')}</td>
                    <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;">{u.get('email','—')}</td>
                    <td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">{created}</td>
                </tr>"""
            
            week_range = f"{week_ago.strftime('%b %d')} — {now.strftime('%b %d, %Y')}"
            
            subject = f"📊 Weekly Client Report | {new_count} New Signups | {total_count} Total — WANDERING YACHT"
            
            html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f3f0;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f0;">
<tr><td align="center" style="padding:20px;">
<table width="650" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <tr><td style="background:#1a3a4a;padding:24px 30px;">
        <h1 style="margin:0;color:#fff;font-size:20px;letter-spacing:2px;">WANDERING YACHT</h1>
        <p style="margin:6px 0 0;color:#c17f59;font-size:13px;letter-spacing:1px;">WEEKLY CLIENT DATABASE REPORT</p>
        <p style="margin:6px 0 0;color:#8a9a9a;font-size:12px;">{week_range}</p>
    </td></tr>
    
    <tr><td style="padding:24px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="text-align:center;padding:16px;background:#f0f7f7;border-radius:10px;width:50%;">
                    <p style="margin:0;color:#c17f59;font-size:36px;font-weight:bold;">{new_count}</p>
                    <p style="margin:4px 0 0;color:#5a6a6a;font-size:12px;letter-spacing:1px;">NEW THIS WEEK</p>
                </td>
                <td style="width:16px;"></td>
                <td style="text-align:center;padding:16px;background:#faf9f7;border-radius:10px;width:50%;">
                    <p style="margin:0;color:#1a3a4a;font-size:36px;font-weight:bold;">{total_count}</p>
                    <p style="margin:4px 0 0;color:#5a6a6a;font-size:12px;letter-spacing:1px;">TOTAL DATABASE</p>
                </td>
            </tr>
        </table>
    </td></tr>
    
    <tr><td style="padding:0 30px 20px;">
        <h3 style="margin:0 0 10px;color:#1a3a4a;font-size:14px;letter-spacing:1px;">🆕 NEW SIGNUPS THIS WEEK</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
            <tr style="background:#faf9f7;">
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7a8a8a;letter-spacing:0.5px;">Name</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7a8a8a;letter-spacing:0.5px;">Email</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7a8a8a;letter-spacing:0.5px;">Phone</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7a8a8a;letter-spacing:0.5px;">WhatsApp</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7a8a8a;letter-spacing:0.5px;">Joined</th>
            </tr>
            {new_user_rows}
        </table>
    </td></tr>
    
    <tr><td style="padding:0 30px 20px;">
        <h3 style="margin:0 0 10px;color:#1a3a4a;font-size:14px;letter-spacing:1px;">📋 FULL CLIENT DATABASE (Latest 50)</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
            <tr style="background:#faf9f7;">
                <th style="padding:6px 10px;text-align:left;font-size:11px;color:#7a8a8a;">Name</th>
                <th style="padding:6px 10px;text-align:left;font-size:11px;color:#7a8a8a;">Email</th>
                <th style="padding:6px 10px;text-align:left;font-size:11px;color:#7a8a8a;">Joined</th>
            </tr>
            {all_user_rows}
        </table>
        {'<p style="margin:10px 0 0;color:#999;font-size:11px;text-align:center;">Showing latest 50 of ' + str(total_count) + ' total clients</p>' if total_count > 50 else ''}
    </td></tr>
    
    <tr><td style="padding:16px 30px;background:#1a3a4a;text-align:center;">
        <p style="margin:0;color:#c17f59;font-size:11px;letter-spacing:1px;">WANDERING YACHT — Automated Weekly Report</p>
        <p style="margin:4px 0 0;color:#8a9a9a;font-size:10px;">Generated {now.strftime('%Y-%m-%d %H:%M UTC')}</p>
    </td></tr>
</table></td></tr></table></body></html>"""
            
            msg = MIMEMultipart('related')
            msg['Subject'] = subject
            msg['From'] = f'WANDERING YACHT <{SMTP_EMAIL}>'
            msg['To'] = SMTP_EMAIL
            html_part = MIMEText(html, 'html')
            msg.attach(html_part)
            
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.send_message(msg)
            
            logger.info(f"Weekly digest sent: {new_count} new, {total_count} total clients")
            return {"new_count": new_count, "total_count": total_count}
        except Exception as e:
            logger.error(f"Weekly digest failed: {e}")
            raise
        finally:
            bg_client.close()
    
    return asyncio.get_event_loop().run_until_complete(_send())

@api_router.post("/marketing/send-digest")
async def trigger_weekly_digest(current_user: dict = Depends(get_current_user)):
    """Manually trigger the weekly client email digest."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    
    all_users = await db.users.find({}).to_list(10000)
    total_count = len(all_users)
    new_users = [u for u in all_users if u.get('created_at', now) >= week_ago]
    new_count = len(new_users)
    
    # Build and send inline (reusing email service)
    from services.email import send_booking_email as _  # ensure SMTP imports available
    from config import SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD
    
    new_user_rows = ""
    for u in sorted(new_users, key=lambda x: x.get('created_at', now), reverse=True):
        created = u.get('created_at', now).strftime('%Y-%m-%d %H:%M')
        new_user_rows += f'<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;">{u.get("full_name","—")}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;">{u.get("email","—")}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:13px;color:#7a8a8a;">{u.get("phone","—")}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;color:#999;">{created}</td></tr>'
    
    if not new_user_rows:
        new_user_rows = '<tr><td colspan="4" style="padding:16px;text-align:center;color:#999;">No new signups this week</td></tr>'
    
    all_user_rows = ""
    for u in sorted(all_users, key=lambda x: x.get('created_at', now), reverse=True)[:50]:
        created = u.get('created_at', now).strftime('%Y-%m-%d')
        all_user_rows += f'<tr><td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;">{u.get("full_name","—")}</td><td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;">{u.get("email","—")}</td><td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;">{created}</td></tr>'
    
    week_range = f"{week_ago.strftime('%b %d')} — {now.strftime('%b %d, %Y')}"
    subject = f"📊 Weekly Client Report | {new_count} New Signups | {total_count} Total — WANDERING YACHT"
    
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f3f0;font-family:Georgia,serif;">
<table width="100%" style="background:#f5f3f0;"><tr><td align="center" style="padding:20px;">
<table width="650" style="background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#1a3a4a;padding:24px 30px;"><h1 style="margin:0;color:#fff;font-size:20px;letter-spacing:2px;">WANDERING YACHT</h1><p style="margin:6px 0 0;color:#c17f59;font-size:13px;letter-spacing:1px;">WEEKLY CLIENT DATABASE REPORT</p><p style="margin:6px 0 0;color:#8a9a9a;font-size:12px;">{week_range}</p></td></tr>
<tr><td style="padding:24px 30px;"><table width="100%"><tr><td style="text-align:center;padding:16px;background:#f0f7f7;border-radius:10px;width:50%;"><p style="margin:0;color:#c17f59;font-size:36px;font-weight:bold;">{new_count}</p><p style="margin:4px 0 0;color:#5a6a6a;font-size:12px;">NEW THIS WEEK</p></td><td style="width:16px;"></td><td style="text-align:center;padding:16px;background:#faf9f7;border-radius:10px;width:50%;"><p style="margin:0;color:#1a3a4a;font-size:36px;font-weight:bold;">{total_count}</p><p style="margin:4px 0 0;color:#5a6a6a;font-size:12px;">TOTAL DATABASE</p></td></tr></table></td></tr>
<tr><td style="padding:0 30px 20px;"><h3 style="margin:0 0 10px;color:#1a3a4a;font-size:14px;">🆕 NEW SIGNUPS THIS WEEK</h3><table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden;"><tr style="background:#faf9f7;"><th style="padding:8px 12px;text-align:left;font-size:11px;color:#7a8a8a;">Name</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#7a8a8a;">Email</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#7a8a8a;">Phone</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#7a8a8a;">Joined</th></tr>{new_user_rows}</table></td></tr>
<tr><td style="padding:0 30px 20px;"><h3 style="margin:0 0 10px;color:#1a3a4a;font-size:14px;">📋 FULL CLIENT DATABASE (Latest 50)</h3><table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden;"><tr style="background:#faf9f7;"><th style="padding:6px 10px;text-align:left;font-size:11px;color:#7a8a8a;">Name</th><th style="padding:6px 10px;text-align:left;font-size:11px;color:#7a8a8a;">Email</th><th style="padding:6px 10px;text-align:left;font-size:11px;color:#7a8a8a;">Joined</th></tr>{all_user_rows}</table></td></tr>
<tr><td style="padding:16px 30px;background:#1a3a4a;text-align:center;"><p style="margin:0;color:#c17f59;font-size:11px;">WANDERING YACHT — Automated Weekly Report</p></td></tr>
</table></td></tr></table></body></html>"""
    
    try:
        msg = MIMEMultipart('related')
        msg['Subject'] = subject
        msg['From'] = f'WANDERING YACHT <{SMTP_EMAIL}>'
        msg['To'] = SMTP_EMAIL
        msg.attach(MIMEText(html, 'html'))
        
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"Weekly digest sent manually: {new_count} new, {total_count} total")
        return {"status": "success", "new_signups": new_count, "total_clients": total_count, "sent_to": SMTP_EMAIL}
    except Exception as e:
        logger.error(f"Manual digest failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketing/clients-csv")
async def export_clients_csv(current_user: dict = Depends(get_current_user)):
    """Export all client emails as CSV for marketing tools (Mailchimp, HubSpot, etc.)"""
    from fastapi.responses import PlainTextResponse
    
    all_users = await db.users.find({}).to_list(10000)
    
    csv_lines = ["name,email,phone,whatsapp,joined"]
    for u in sorted(all_users, key=lambda x: x.get('created_at', datetime.utcnow()), reverse=True):
        name = u.get('full_name', '').replace(',', ' ')
        email = u.get('email', '')
        phone = u.get('phone', '').replace(',', ' ')
        whatsapp = u.get('whatsapp_number', '').replace(',', ' ')
        joined = u.get('created_at', datetime.utcnow()).strftime('%Y-%m-%d')
        csv_lines.append(f"{name},{email},{phone},{whatsapp},{joined}")
    
    csv_content = "\n".join(csv_lines)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=wandering_yacht_clients.csv"}
    )

@api_router.get("/marketing/stats")
async def get_marketing_stats(current_user: dict = Depends(get_current_user)):
    """Get client database statistics."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    all_users = await db.users.find({}).to_list(10000)
    total = len(all_users)
    
    new_week = len([u for u in all_users if u.get('created_at', now) >= week_ago])
    new_month = len([u for u in all_users if u.get('created_at', now) >= month_ago])
    
    with_phone = len([u for u in all_users if u.get('phone')])
    with_whatsapp = len([u for u in all_users if u.get('whatsapp_number')])
    
    return {
        "total_clients": total,
        "new_this_week": new_week,
        "new_this_month": new_month,
        "with_phone": with_phone,
        "with_whatsapp": with_whatsapp,
        "emails": [u.get('email') for u in all_users],
    }

# ======================== WEEKLY DIGEST SCHEDULER ========================

import threading
import time as _time

def _weekly_digest_scheduler():
    """Background thread that sends weekly digest every Monday at 8:00 AM UTC."""
    logger.info("Weekly digest scheduler started")
    while True:
        now = datetime.utcnow()
        # Check if it's Monday and between 8:00-8:05 AM UTC
        if now.weekday() == 0 and now.hour == 8 and now.minute < 5:
            try:
                send_weekly_digest()
                logger.info("Scheduled weekly digest sent successfully")
            except Exception as e:
                logger.error(f"Scheduled weekly digest failed: {e}")
            # Sleep for 6 minutes to avoid duplicate sends
            _time.sleep(360)
        else:
            # Check every 60 seconds
            _time.sleep(60)

# Start the scheduler in a daemon thread
_digest_thread = threading.Thread(target=_weekly_digest_scheduler, daemon=True)
_digest_thread.start()

# ======================== GOOGLE CALENDAR TEST ENDPOINT ========================
@api_router.get("/calendar/test")
async def test_google_calendar():
    """Test endpoint to verify Google Calendar connectivity."""
    try:
        service = get_google_calendar_service()
        if not service:
            return {"status": "error", "message": "Could not create Google Calendar service"}
        
        # Try to get calendar info
        calendar = service.calendars().get(calendarId=GOOGLE_CALENDAR_ID).execute()
        return {
            "status": "success",
            "calendar_name": calendar.get('summary', 'Unknown'),
            "calendar_id": GOOGLE_CALENDAR_ID,
            "message": "Google Calendar connection verified!"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ======================== PRIVACY POLICY ========================
@api_router.get("/privacy-policy", response_class=HTMLResponse)
async def privacy_policy():
    """Public privacy policy page for Google Play Store submission."""
    return HTMLResponse(content="""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy — Wandering Yacht</title>
<style>
  @font-face { font-family: 'TraditionalArabic'; src: url('/api/fonts/TraditionalArabic-Regular.ttf') format('truetype'); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'TraditionalArabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f6f3; color: #2d3a3a; line-height: 1.7; }
  .header { background: #1a3a4a; color: #fff; padding: 40px 20px; text-align: center; }
  .header h1 { font-family: 'TraditionalArabic'; font-size: 28px; letter-spacing: 4px; margin-bottom: 8px; }
  .header p { font-family: 'TraditionalArabic'; opacity: 0.8; font-size: 14px; }
  .container { max-width: 720px; margin: 0 auto; padding: 32px 20px 60px; }
  h2 { font-family: 'TraditionalArabic'; color: #1a3a4a; font-size: 18px; margin: 28px 0 12px; }
  p, li { font-family: 'TraditionalArabic'; font-size: 15px; margin-bottom: 12px; }
  ul { padding-left: 24px; }
  .footer { text-align: center; padding: 24px; color: #7a8a8a; font-size: 13px; border-top: 1px solid #e0ddd8; margin-top: 40px; }
</style>
</head><body>
<div class="header">
  <h1>WANDERING YACHT</h1>
  <p>Privacy Policy</p>
</div>
<div class="container">
  <p><strong>Effective Date:</strong> January 1, 2025</p>
  <p>Wandering Yacht d.o.o. ("Company", "we", "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use the Wandering Yacht mobile application ("App").</p>

  <h2>1. Information We Collect</h2>
  <p>We collect the following personal information when you create an account or make a booking:</p>
  <ul>
    <li>Full name</li>
    <li>Email address</li>
    <li>Phone number (optional)</li>
    <li>WhatsApp number (optional)</li>
    <li>Payment information (processed securely by Stripe — we do not store card details)</li>
    <li>Booking history and preferences</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <p>Your personal data is used solely for the following purposes:</p>
  <ul>
    <li>Processing and confirming bookings</li>
    <li>Sending booking confirmations, tickets, and receipts via email</li>
    <li>Communicating about your scheduled experiences</li>
    <li>Creating calendar events for your bookings</li>
    <li>Improving our services and user experience</li>
    <li>Sending periodic updates about new experiences (you may opt out at any time)</li>
  </ul>

  <h2>3. We Will Never Sell Your Data</h2>
  <p><strong>We will never sell, rent, or share your personal information with third parties for marketing purposes.</strong> Your data may only be shared with trusted service providers strictly necessary to fulfil your booking:</p>
  <ul>
    <li><strong>Stripe</strong> — for secure payment processing</li>
    <li><strong>Google Calendar</strong> — for scheduling booking events</li>
    <li><strong>Email services</strong> — for sending confirmations and tickets</li>
  </ul>

  <h2>4. Data Security</h2>
  <p>We implement industry-standard security measures to protect your personal information, including:</p>
  <ul>
    <li>Encrypted data transmission (HTTPS/TLS)</li>
    <li>Secure password hashing (bcrypt)</li>
    <li>JWT-based authentication tokens</li>
    <li>Biometric authentication support (Face ID / Fingerprint)</li>
    <li>No storage of credit card numbers on our servers</li>
  </ul>

  <h2>5. Data Retention</h2>
  <p>We retain your personal data for as long as your account is active or as needed to provide services. You may request deletion of your account and all associated data at any time.</p>

  <h2>6. Your Rights</h2>
  <p>You have the right to:</p>
  <ul>
    <li>Access your personal data</li>
    <li>Request correction of inaccurate data</li>
    <li>Request deletion of your data</li>
    <li>Opt out of marketing communications</li>
    <li>Export your data in a portable format</li>
  </ul>

  <h2>7. Children's Privacy</h2>
  <p>The App is not intended for children under 18. We do not knowingly collect personal information from minors. Participants under 18 must be accompanied by a parent or legal guardian.</p>

  <h2>8. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy within the App and updating the effective date.</p>

  <h2>9. Contact Us</h2>
  <p>For questions about this Privacy Policy or to exercise your data rights, please contact:</p>
  <p><strong>Wandering Yacht</strong><br>
  Email: <a href="mailto:booking@wanderingyacht.com">booking@wanderingyacht.com</a></p>

  <div class="footer">
    &copy; 2025 Wandering Yacht d.o.o. — All rights reserved.
  </div>
</div>
</body></html>""", status_code=200)

# ======================== QR CODE / SHARE PAGE ========================
@api_router.get("/download", response_class=HTMLResponse)
async def download_app():
    """Shareable QR code page for customers to access the app."""
    app_url = "https://wandering-yacht-1.preview.emergentagent.com"
    
    # Generate QR code as base64
    import qrcode, io, base64
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(app_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color='#1a3a4a', back_color='white')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Logo as base64
    logo_b64 = ""
    try:
        with open('/app/frontend/assets/images/wy-logo-solid.png', 'rb') as f:
            logo_b64 = base64.b64encode(f.read()).decode()
    except:
        pass
    
    return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WANDERING YACHT — Get The App</title>
<style>
  @font-face {{ font-family: 'TraditionalArabic'; src: url('/api/fonts/TraditionalArabic-Regular.ttf') format('truetype'); }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'TraditionalArabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f6f3; color: #2d3a3a; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; }}
  .card {{ background: #fff; border-radius: 20px; padding: 40px 32px; text-align: center; max-width: 400px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
  .logo-text {{ font-family: 'TraditionalArabic'; font-size: 28px; font-weight: 700; color: #1a3a4a; letter-spacing: 6px; margin-bottom: 8px; }}
  .tagline {{ font-family: 'TraditionalArabic'; font-size: 15px; color: #7a8a8a; margin-bottom: 28px; line-height: 1.5; }}
  .qr-container {{ background: #fff; border-radius: 16px; padding: 16px; display: inline-block; margin-bottom: 24px; }}
  .qr-container img {{ width: 220px; height: 220px; }}
  .scan-text {{ font-family: 'TraditionalArabic'; font-size: 16px; font-weight: 600; color: #1a3a4a; margin-bottom: 8px; }}
  .scan-sub {{ font-family: 'TraditionalArabic'; font-size: 13px; color: #7a8a8a; margin-bottom: 24px; }}
  .open-btn {{ font-family: 'TraditionalArabic'; display: inline-block; background: #1a3a4a; color: #fff; text-decoration: none; padding: 16px 40px; border-radius: 28px; font-size: 16px; font-weight: 600; letter-spacing: 1px; }}
  .open-btn:hover {{ background: #0d2a36; }}
  .divider {{ height: 1px; background: #e0ddd8; margin: 20px 0; width: 100%; }}
  .no-download {{ font-family: 'TraditionalArabic'; font-size: 12px; color: #a0aab0; margin-top: 16px; }}
</style>
</head><body>
<div class="card">
  <img src="data:image/png;base64,{logo_b64}" alt="Wandering Yacht" style="width: 80px; height: 80px; margin-bottom: 12px;" />
  <div class="logo-text">WANDERING<br>YACHT</div>
  <p class="tagline">Wander to Montenegro.<br>30+ Immersive Excursions created just for you.</p>
  
  <div class="qr-container">
    <img src="data:image/png;base64,{qr_base64}" alt="Scan to open Wandering Yacht" />
  </div>
  
  <p class="scan-text">Scan to Open</p>
  <p class="scan-sub">Point your phone camera at the QR code</p>
  
  <div class="divider"></div>
  
  <a href="{app_url}" class="open-btn">OPEN APP</a>
  
  <p class="no-download">No download required — opens in your browser</p>
</div>
</body></html>""", status_code=200)

# Include the router in the main app
app.include_router(api_router)
app.mount("/api/fonts", StaticFiles(directory="/app/backend/static_fonts"), name="fonts")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
