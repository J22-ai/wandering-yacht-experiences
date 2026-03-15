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

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None
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
        created_at=current_user["created_at"]
    )

# ======================== CATEGORIES ROUTES ========================

@api_router.get("/categories", response_model=List[ServiceCategory])
async def get_categories():
    # Return predefined categories
    categories = [
        ServiceCategory(
            id="experiences",
            name="Experiences",
            slug="experiences",
            description="Unforgettable moments on the water",
            image_url="https://images.unsplash.com/photo-1531419746980-63af10612bf3?w=800",
            icon="compass"
        ),
        ServiceCategory(
            id="boat_rental",
            name="Boat Rental",
            slug="boat_rental",
            description="Premium boats for every adventure",
            image_url="https://images.unsplash.com/photo-1622789095468-2afd0589b011?w=800",
            icon="sailboat"
        ),
        ServiceCategory(
            id="yacht_charter",
            name="Yacht Charter",
            slug="yacht_charter",
            description="Luxury charters for special occasions",
            image_url="https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800",
            icon="ship"
        ),
        ServiceCategory(
            id="management",
            name="Management",
            slug="management",
            description="Professional yacht management services",
            image_url="https://images.unsplash.com/photo-1523496922380-91d5afba98a3?w=800",
            icon="briefcase"
        )
    ]
    return categories

# ======================== EXPERIENCES ROUTES ========================

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
    
    # Verify payment with Stripe
    if booking.get("payment_intent_id"):
        try:
            intent = stripe.PaymentIntent.retrieve(booking["payment_intent_id"])
            if intent.status != "succeeded":
                raise HTTPException(status_code=400, detail="Payment not completed")
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
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

@api_router.post("/seed")
async def seed_data():
    """Seed initial experiences data"""
    # Check if already seeded
    count = await db.experiences.count_documents({})
    if count > 0:
        return {"message": "Data already seeded", "count": count}
    
    experiences = [
        # Experiences Category
        {
            "id": str(uuid.uuid4()),
            "title": "Sunset Yacht Party",
            "description": "Experience the magic of a Mediterranean sunset aboard our luxury yacht. Includes champagne, canapés, and live DJ.",
            "category": "experiences",
            "location": "Miami Beach Marina",
            "date": "2025-08-15",
            "image_url": "https://images.unsplash.com/photo-1531419746980-63af10612bf3?w=800",
            "capacity": 50,
            "available_spots": 50,
            "duration_hours": 4,
            "amenities": ["Open Bar", "Live DJ", "Catering", "Photo Booth"],
            "included": ["Welcome drink", "Gourmet dinner", "Party favors"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Standard", "description": "Access to main deck", "price": 150, "max_per_booking": 10},
                {"id": str(uuid.uuid4()), "name": "VIP", "description": "Access to VIP lounge + premium bar", "price": 300, "max_per_booking": 6}
            ],
            "time_slots": [
                {"id": str(uuid.uuid4()), "start_time": "18:00", "end_time": "22:00", "available_spots": 50}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Private Island Excursion",
            "description": "Escape to a secluded private island with swimming, snorkeling, and a beach BBQ.",
            "category": "experiences",
            "location": "Key Biscayne",
            "date": "2025-08-20",
            "image_url": "https://images.unsplash.com/photo-1570911274539-77ee179c3ab5?w=800",
            "capacity": 30,
            "available_spots": 30,
            "duration_hours": 6,
            "amenities": ["Snorkel Gear", "Beach Setup", "Water Sports"],
            "included": ["Lunch", "Drinks", "Equipment rental"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Adult", "description": "Full experience", "price": 250, "max_per_booking": 8},
                {"id": str(uuid.uuid4()), "name": "Child (5-12)", "description": "Kids activities included", "price": 125, "max_per_booking": 8}
            ],
            "time_slots": [
                {"id": str(uuid.uuid4()), "start_time": "09:00", "end_time": "15:00", "available_spots": 30}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # Boat Rental Category
        {
            "id": str(uuid.uuid4()),
            "title": "Speedboat Adventure",
            "description": "Rent our premium speedboat for an exhilarating day on the water. Perfect for island hopping.",
            "category": "boat_rental",
            "location": "Fort Lauderdale Marina",
            "date": "2025-08-01",
            "image_url": "https://images.unsplash.com/photo-1622789095468-2afd0589b011?w=800",
            "capacity": 8,
            "available_spots": 8,
            "duration_hours": 8,
            "amenities": ["GPS Navigation", "Bluetooth Audio", "Cooler"],
            "included": ["Fuel", "Safety equipment", "Brief training"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Half Day (4hr)", "description": "4 hours rental", "price": 400, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Full Day (8hr)", "description": "8 hours rental", "price": 700, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Luxury Pontoon Cruise",
            "description": "Spacious pontoon perfect for family gatherings and leisurely cruises.",
            "category": "boat_rental",
            "location": "Miami Beach Marina",
            "date": "2025-08-01",
            "image_url": "https://images.unsplash.com/photo-1700731713986-c35dedba158a?w=800",
            "capacity": 12,
            "available_spots": 12,
            "duration_hours": 8,
            "amenities": ["Sun Shade", "Bluetooth Audio", "Swim Ladder", "Cooler"],
            "included": ["Fuel", "Captain optional", "Safety gear"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Half Day (4hr)", "description": "4 hours rental", "price": 350, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Full Day (8hr)", "description": "8 hours rental", "price": 600, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # Yacht Charter Category
        {
            "id": str(uuid.uuid4()),
            "title": "50ft Luxury Yacht Charter",
            "description": "Experience ultimate luxury aboard our 50ft yacht with professional crew. Perfect for celebrations.",
            "category": "yacht_charter",
            "location": "Miami Beach Marina",
            "date": "2025-08-01",
            "image_url": "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800",
            "capacity": 12,
            "available_spots": 12,
            "duration_hours": 8,
            "amenities": ["Professional Crew", "Water Toys", "Sound System", "Air Conditioning"],
            "included": ["Captain", "Fuel", "Water toys", "Ice & water"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "4 Hour Charter", "description": "Half day luxury experience", "price": 2000, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "8 Hour Charter", "description": "Full day adventure", "price": 3500, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "80ft Mega Yacht Experience",
            "description": "Our flagship 80ft mega yacht offers unparalleled luxury with multiple decks and jacuzzi.",
            "category": "yacht_charter",
            "location": "Fort Lauderdale Marina",
            "date": "2025-08-01",
            "image_url": "https://images.unsplash.com/photo-1523496922380-91d5afba98a3?w=800",
            "capacity": 20,
            "available_spots": 20,
            "duration_hours": 8,
            "amenities": ["Jacuzzi", "Multiple Decks", "Jet Skis", "Professional Chef"],
            "included": ["Crew of 4", "Fuel", "Gourmet lunch", "Premium bar"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Half Day Charter", "description": "4 hours of luxury", "price": 5000, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Full Day Charter", "description": "8 hours ultimate experience", "price": 8500, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        # Management Category
        {
            "id": str(uuid.uuid4()),
            "title": "Full Yacht Management Package",
            "description": "Complete management of your yacht including maintenance, crew, and charter operations.",
            "category": "management",
            "location": "South Florida",
            "date": "2025-08-01",
            "image_url": "https://images.unsplash.com/photo-1523496922380-91d5afba98a3?w=800",
            "capacity": 10,
            "available_spots": 10,
            "duration_hours": 0,
            "amenities": ["24/7 Support", "Maintenance", "Crew Management", "Charter Services"],
            "included": ["Monthly reports", "Insurance handling", "Compliance management"],
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Consultation", "description": "Initial consultation and assessment", "price": 500, "max_per_booking": 1},
                {"id": str(uuid.uuid4()), "name": "Monthly Retainer", "description": "Full management services", "price": 3000, "max_per_booking": 1}
            ],
            "is_active": True,
            "created_at": datetime.utcnow()
        }
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
