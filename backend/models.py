from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime

# ======================== USER MODELS ========================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    # Anti-bot fields (invisible to real users)
    website: Optional[str] = None  # Honeypot - bots fill this, humans don't see it
    form_loaded_at: Optional[str] = None  # Timing check

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

# ======================== CATEGORY MODELS ========================

class ServiceCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    description: str
    image_url: str
    icon: str

# ======================== EXPERIENCE MODELS ========================

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
    category: str
    location: str
    date: str
    image_url: Optional[str] = None
    capacity: int
    ticket_types: List[TicketType]
    time_slots: Optional[List[TimeSlot]] = None
    duration_hours: Optional[float] = None
    amenities: Optional[List[str]] = []
    included: Optional[List[str]] = []
    requires_deposit: bool = False
    deposit_percentage: float = 30

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
    requires_deposit: bool = False
    deposit_percentage: float = 30
    taxes_included: Optional[bool] = None
    deposit_note: Optional[str] = None
    charter_packages: Optional[List[dict]] = None
    images: Optional[List[str]] = None

# ======================== BOOKING MODELS ========================

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
    selected_date: Optional[str] = None

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
    status: str = "pending"
    payment_status: str = "unpaid"
    payment_type: str = "full"
    deposit_percentage: float = 0
    deposit_amount: float = 0
    remaining_balance: float = 0
    payment_intent_id: Optional[str] = None
    qr_code: Optional[str] = None
    special_requests: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    confirmed_at: Optional[datetime] = None

# ======================== PAYMENT MODELS ========================

class PaymentIntentCreate(BaseModel):
    booking_id: str

class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    publishable_key: str

# ======================== PASSKEY MODELS ========================

class PasskeyRegisterRequest(BaseModel):
    credential: str

class PasskeyAuthRequest(BaseModel):
    credential: str

class BalancePaymentRequest(BaseModel):
    payment_intent_id: Optional[str] = None

class UpdateExperienceImage(BaseModel):
    title: str
    image_url: str
