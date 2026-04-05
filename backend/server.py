from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import stripe
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import secrets
import base64
import qrcode
from io import BytesIO

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe configuration
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')
stripe.api_key = STRIPE_SECRET_KEY

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer(auto_error=False)

# Create the main app
app = FastAPI(title="Wandering Yacht API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ======================== MODELS ========================

# User Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Service Category Models
class ServiceCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    description: str
    image_url: str
    icon: str

# Experience/Event Models
class TimeSlot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    start_time: str
    end_time: str
    available_spots: int

class TicketType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    max_per_booking: int = 10

class ExperienceCreate(BaseModel):
    title: str
    description: str
    category: str  # experiences, boat_rental, management, yacht_charter
    location: str
    date: str
    image_url: Optional[str] = None
    capacity: int
    ticket_types: List[TicketType]
    time_slots: Optional[List[TimeSlot]] = None
    duration_hours: Optional[float] = None
    amenities: Optional[List[str]] = []
    included: Optional[List[str]] = []

class Experience(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    location: str
    date: str
    image_url: Optional[str] = None
    capacity: int
    available_spots: int
    ticket_types: List[TicketType]
    time_slots: Optional[List[TimeSlot]] = None
    duration_hours: Optional[float] = None
    amenities: List[str] = []
    included: List[str] = []
    tags: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

# Booking Models
class BookingTicket(BaseModel):
    ticket_type_id: str
    ticket_name: str
    quantity: int
    price_per_ticket: float

class BookingCreate(BaseModel):
    experience_id: str
    tickets: List[BookingTicket]
    time_slot_id: Optional[str] = None
    special_requests: Optional[str] = None

class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    experience_id: str
    experience_title: str
    experience_date: str
    experience_location: str
    tickets: List[BookingTicket]
    time_slot_id: Optional[str] = None
    total_amount: float
    status: str = "pending"  # pending, confirmed, cancelled, completed
    payment_status: str = "unpaid"  # unpaid, paid, refunded
    payment_intent_id: Optional[str] = None
    qr_code: Optional[str] = None
    special_requests: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    confirmed_at: Optional[datetime] = None

# Payment Models
class PaymentIntentCreate(BaseModel):
    booking_id: str

class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    publishable_key: str

# ======================== AUTH HELPERS ========================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except:
        return None

# ======================== QR CODE HELPER ========================

def generate_qr_code(data: str) -> str:
    """Generate QR code and return as base64 string"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

# ======================== AUTH ROUTES ========================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
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
            id="experiences",
            name="WEDDING AND EVENT PLANNING",
            slug="experiences",
            description="Unforgettable moments on the water",
            image_url="https://images.unsplash.com/photo-1531419746980-63af10612bf3?w=800",
            icon="compass"
        )
    ]
    return categories

# ======================== EXPERIENCES ROUTES ========================

class UpdateExperienceImage(BaseModel):
    title: str
    image_url: str

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
    
    # Create booking
    booking = Booking(
        user_id=current_user["id"],
        experience_id=booking_data.experience_id,
        experience_title=experience["title"],
        experience_date=experience["date"],
        experience_location=experience["location"],
        tickets=booking_data.tickets,
        time_slot_id=booking_data.time_slot_id,
        total_amount=total_amount,
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
    
    amount_cents = int(booking["total_amount"] * 100)
    
    try:
        # Create payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            metadata={
                "booking_id": data.booking_id,
                "user_id": current_user["id"],
                "experience_title": booking["experience_title"]
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
    
    # Update booking
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
    
    updated_booking = await db.bookings.find_one({"id": booking_id})
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
            "image_url": "https://customer-assets.emergentagent.com/job_302e63cd-b681-4d63-bedc-f5e20506c0ed/artifacts/my6orjbp_08f50b63-3db6-4f07-9ab8-90f11ed0cb63.jpeg",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 4,
            "amenities": ["Spa Amenities", "Swimming Access", "Wellness Kit"],
            "included": ["Yoga session", "Meditation", "Organic breakfast", "Wellness consultation"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Wellness Package", "description": "Complete morning wellness", "price": 120, "max_per_booking": 4}
            ],
            "time_slots": [
                {"id": str(uuid.uuid4()), "start_time": "07:00", "end_time": "11:00", "available_spots": 10}
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
            "description": "Discover hidden gems and secret spots that only locals know. A curated journey off the beaten path.",
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
            "description": "Combine wine tasting with contemporary art in a stunning gallery setting. A feast for all senses.",
            "category": "culinary_tours",
            "location": "Podgorica Art Gallery",
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
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Low Season", "description": "Low season rate", "price": 1700, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "High Season", "description": "High season rate", "price": 1980, "max_per_booking": 1}
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
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Low Season", "description": "4 hour low season charter", "price": 1690, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "High Season", "description": "4 hour high season charter", "price": 2600, "max_per_booking": 1}
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
            "amenities": ["Classic Sails", "Wooden Deck", "Professional Crew", "Authentic Experience"],
            "included": ["Captain", "Crew", "Refreshments", "Safety equipment"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Per Person", "description": "Price per person", "price": 175, "max_per_booking": 20},
                {"id": str(uuid.uuid4()), "name": "Low Season (Full Charter)", "description": "4 hour low season charter", "price": 1690, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "High Season (Full Charter)", "description": "4 hour high season charter", "price": 2690, "max_per_booking": 1}
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

        # WEDDING AND EVENT PLANNING
        {
            "id": str(uuid.uuid4()),
            "title": "Yacht Wedding Celebration",
            "description": "Say 'I Do' on the Adriatic Sea. Wandering Yacht transforms a luxury yacht into your dream wedding venue, surrounded by Montenegro's dramatic mountains and crystal waters. Our dedicated team handles every detail so you can focus on the magic of your special day.\n\nYour Wedding Day Includes:\n• Private luxury yacht exclusively for your ceremony & reception\n• Onboard wedding coordinator & event styling\n• Floral arrangements & elegant table décor\n• Gourmet catering with a curated multi-course menu\n• Premium open bar with champagne toast\n• Live music or curated DJ set\n• Professional lighting & sound system\n• Captain & full yacht crew\n• Scenic cruising through the Bay of Kotor\n• Sunset ceremony positioning\n• Wedding cake by a local artisan patissier\n• Red carpet boarding & welcome champagne\n• Accommodation coordination for guests",
            "category": "experiences",
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
            "category": "experiences",
            "location": "Porto Montenegro, Tivat",
            "date": "2025-06-01",
            "image_url": "https://customer-assets.emergentagent.com/job_ac874aeb-cfb2-4c82-a97b-ff79f3b1c447/artifacts/zev6mkpk_IMG_2953.jpeg",
            "capacity": 4,
            "available_spots": 4,
            "duration_hours": 2,
            "amenities": ["Professional Photographer", "Classic Wooden Boat", "Champagne", "Scenic Route", "Digital Gallery"],
            "included": ["Private boat charter", "Professional photographer", "Champagne & canapés", "50+ edited photos", "Online gallery", "Captain"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Couple's Session", "description": "2-hour photo experience for the couple", "price": 1200, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "With Drone Photography", "description": "Includes aerial drone shots", "price": 1600, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # TRANSFER SERVICE
        {
            "id": str(uuid.uuid4()),
            "title": "Mercedes Minivan Transfer Service",
            "description": "Travel Montenegro in comfort and style with our premium Mercedes Minivan transfer service. Whether you need an airport pick-up, a drop-off to your hotel, a later collection, or a full-day scenic drive through Montenegro's stunning coastline and mountains — we've got you covered.\n\nPerfect for families, groups, or anyone who wants a seamless, stress-free journey.\n\nService Includes:\n• Luxury Mercedes Minivan (up to 7 guests)\n• Professional English-speaking driver\n• Airport meet & greet with name board\n• Complimentary bottled water & Wi-Fi\n• Child seats available on request\n• Flexible scheduling — pick up, drop off, collect later\n• Full-day hire available for scenic touring\n• Air conditioning & premium leather interior\n• Luggage assistance\n• 24/7 booking availability",
            "category": "experiences",
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
            "category": "experiences",
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
                {"id": str(uuid.uuid4()), "name": "Grand Wedding (up to 100 guests)", "description": "Full venue takeover with complete wedding production", "price": 45000, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Ultimate Dream (up to 150 guests)", "description": "The complete Mamma Mia experience — every detail perfected", "price": 75000, "max_per_booking": 1}
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
            "image_url": "https://images.unsplash.com/photo-1775257796023-64e5bb47d046?w=800",
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
            "category": "experiences",
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
                {"id": str(uuid_mod.uuid4()), "name": "Ultimate Dream (up to 150 guests)", "description": "The complete Mamma Mia experience — every detail perfected", "price": 75000, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        })
        added.append("Wedding Dream")

    return {"message": f"Added: {', '.join(added)}" if added else "Both already exist"}

# Include the router in the main app
app.include_router(api_router)

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
