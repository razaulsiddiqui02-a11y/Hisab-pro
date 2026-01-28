from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import base64
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'findback_db')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'findback-super-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Security
security = HTTPBearer(auto_error=False)

app = FastAPI(title="FindBack API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== PYDANTIC MODELS ==============

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str

class RegisterRequest(BaseModel):
    phone: str
    name: str
    otp: str

class UserResponse(BaseModel):
    id: str
    phone: str
    name: str
    role: str
    blocked: bool
    created_at: datetime
    push_token: Optional[str] = None

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

class VerificationQuestion(BaseModel):
    question: str
    answer: str

class ItemCreate(BaseModel):
    category: str
    city: str
    location: str
    date_found: str
    description: str
    images: List[str]  # Base64 images
    verification_questions: List[VerificationQuestion]

class ItemResponse(BaseModel):
    id: str
    finder_id: str
    finder_name: str
    category: str
    city: str
    location: str
    date_found: str
    description: str
    images: List[str]
    status: str  # pending, approved, closed, handed_over
    created_at: datetime
    has_verification_questions: bool

class ItemDetailResponse(ItemResponse):
    verification_questions: Optional[List[Dict[str, str]]] = None  # Only questions, not answers

class ClaimCreate(BaseModel):
    item_id: str
    answers: List[str]  # Answers to verification questions

class ClaimResponse(BaseModel):
    id: str
    item_id: str
    claimer_id: str
    claimer_name: str
    status: str  # pending, approved, rejected
    created_at: datetime

class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    content: str
    created_at: datetime

class ChatResponse(BaseModel):
    id: str
    item_id: str
    item_title: str
    finder_id: str
    finder_name: str
    claimer_id: str
    claimer_name: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0

class ReportCreate(BaseModel):
    reported_user_id: Optional[str] = None
    item_id: Optional[str] = None
    reason: str

class ReportResponse(BaseModel):
    id: str
    reporter_id: str
    reporter_name: str
    reported_user_id: Optional[str] = None
    reported_user_name: Optional[str] = None
    item_id: Optional[str] = None
    reason: str
    status: str  # pending, resolved, dismissed
    created_at: datetime

class AdminStatsResponse(BaseModel):
    total_users: int
    total_items: int
    pending_items: int
    approved_items: int
    resolved_cases: int
    pending_reports: int

class UpdateUserRequest(BaseModel):
    blocked: Optional[bool] = None
    role: Optional[str] = None

class UpdateItemStatusRequest(BaseModel):
    status: str

class UpdateClaimStatusRequest(BaseModel):
    status: str

class UpdateReportStatusRequest(BaseModel):
    status: str

class UpdatePushTokenRequest(BaseModel):
    push_token: str

# ============== HELPER FUNCTIONS ==============

def create_jwt_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get('user_id')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = decode_jwt_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if user.get('blocked', False):
        raise HTTPException(status_code=403, detail="User is blocked")
    
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def serialize_user(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user['_id']),
        phone=user['phone'],
        name=user['name'],
        role=user.get('role', 'user'),
        blocked=user.get('blocked', False),
        created_at=user.get('created_at', datetime.utcnow()),
        push_token=user.get('push_token')
    )

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/send-otp")
async def send_otp(request: SendOTPRequest):
    """Send OTP to phone number (Mock - always succeeds)"""
    # Store OTP in database (for MVP, OTP is always 123456)
    await db.otp_codes.update_one(
        {"phone": request.phone},
        {"$set": {"phone": request.phone, "otp": "123456", "created_at": datetime.utcnow()}},
        upsert=True
    )
    logger.info(f"OTP sent to {request.phone}: 123456")
    return {"message": "OTP sent successfully", "debug_otp": "123456"}  # Remove debug_otp in production

@api_router.post("/auth/verify-otp", response_model=AuthResponse)
async def verify_otp(request: VerifyOTPRequest):
    """Verify OTP and login/register user"""
    # Check OTP
    otp_record = await db.otp_codes.find_one({"phone": request.phone})
    if not otp_record or otp_record.get('otp') != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Check if user exists
    user = await db.users.find_one({"phone": request.phone})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please register first.")
    
    if user.get('blocked', False):
        raise HTTPException(status_code=403, detail="User is blocked")
    
    # Delete OTP
    await db.otp_codes.delete_one({"phone": request.phone})
    
    # Create token
    token = create_jwt_token(str(user['_id']))
    
    return AuthResponse(token=token, user=serialize_user(user))

@api_router.post("/auth/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """Register new user with OTP verification"""
    # Check OTP
    otp_record = await db.otp_codes.find_one({"phone": request.phone})
    if not otp_record or otp_record.get('otp') != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Check if user exists
    existing_user = await db.users.find_one({"phone": request.phone})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists. Please login.")
    
    # Create user
    user_data = {
        "phone": request.phone,
        "name": request.name,
        "role": "user",
        "blocked": False,
        "created_at": datetime.utcnow(),
        "push_token": None
    }
    
    result = await db.users.insert_one(user_data)
    user_data['_id'] = result.inserted_id
    
    # Delete OTP
    await db.otp_codes.delete_one({"phone": request.phone})
    
    # Create token
    token = create_jwt_token(str(result.inserted_id))
    
    logger.info(f"New user registered: {request.phone}")
    return AuthResponse(token=token, user=serialize_user(user_data))

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return serialize_user(current_user)

@api_router.put("/auth/push-token")
async def update_push_token(request: UpdatePushTokenRequest, current_user: dict = Depends(get_current_user)):
    """Update user's push notification token"""
    await db.users.update_one(
        {"_id": current_user['_id']},
        {"$set": {"push_token": request.push_token}}
    )
    return {"message": "Push token updated"}

# ============== ITEMS ENDPOINTS ==============

@api_router.post("/items", response_model=ItemResponse)
async def create_item(item: ItemCreate, current_user: dict = Depends(get_current_user)):
    """Create a new found item post"""
    if len(item.images) < 1 or len(item.images) > 3:
        raise HTTPException(status_code=400, detail="Please upload 1-3 images")
    
    if len(item.verification_questions) < 1:
        raise HTTPException(status_code=400, detail="Please add at least one verification question")
    
    item_data = {
        "finder_id": str(current_user['_id']),
        "finder_name": current_user['name'],
        "category": item.category,
        "city": item.city,
        "location": item.location,
        "date_found": item.date_found,
        "description": item.description,
        "images": item.images,
        "verification_questions": [q.dict() for q in item.verification_questions],
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    result = await db.items.insert_one(item_data)
    item_data['_id'] = result.inserted_id
    
    logger.info(f"New item created by {current_user['phone']}: {item.category}")
    
    return ItemResponse(
        id=str(result.inserted_id),
        finder_id=item_data['finder_id'],
        finder_name=item_data['finder_name'],
        category=item_data['category'],
        city=item_data['city'],
        location=item_data['location'],
        date_found=item_data['date_found'],
        description=item_data['description'],
        images=item_data['images'],
        status=item_data['status'],
        created_at=item_data['created_at'],
        has_verification_questions=True
    )

@api_router.get("/items", response_model=List[ItemResponse])
async def get_items(
    category: Optional[str] = None,
    city: Optional[str] = None,
    status: Optional[str] = None,
    my_items: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get list of items with optional filters"""
    query = {}
    
    if my_items:
        query["finder_id"] = str(current_user['_id'])
    else:
        # Only show approved items for non-owners
        query["status"] = "approved"
    
    if category:
        query["category"] = category
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if status and my_items:
        query["status"] = status
    
    items = await db.items.find(query).sort("created_at", -1).to_list(100)
    
    return [
        ItemResponse(
            id=str(item['_id']),
            finder_id=item['finder_id'],
            finder_name=item['finder_name'],
            category=item['category'],
            city=item['city'],
            location=item['location'],
            date_found=item['date_found'],
            description=item['description'],
            images=item['images'],
            status=item['status'],
            created_at=item['created_at'],
            has_verification_questions=bool(item.get('verification_questions'))
        )
        for item in items
    ]

@api_router.get("/items/{item_id}", response_model=ItemDetailResponse)
async def get_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """Get item details"""
    try:
        item = await db.items.find_one({"_id": ObjectId(item_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid item ID")
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Only show verification questions (not answers) to non-finders
    verification_questions = None
    if item.get('verification_questions'):
        if item['finder_id'] == str(current_user['_id']):
            verification_questions = item['verification_questions']
        else:
            verification_questions = [{"question": q['question']} for q in item['verification_questions']]
    
    return ItemDetailResponse(
        id=str(item['_id']),
        finder_id=item['finder_id'],
        finder_name=item['finder_name'],
        category=item['category'],
        city=item['city'],
        location=item['location'],
        date_found=item['date_found'],
        description=item['description'],
        images=item['images'],
        status=item['status'],
        created_at=item['created_at'],
        has_verification_questions=bool(item.get('verification_questions')),
        verification_questions=verification_questions
    )

@api_router.put("/items/{item_id}/status")
async def update_item_status(
    item_id: str,
    request: UpdateItemStatusRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update item status (for finder to mark as handed over)"""
    try:
        item = await db.items.find_one({"_id": ObjectId(item_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid item ID")
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Only finder or admin can update
    if item['finder_id'] != str(current_user['_id']) and current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    valid_statuses = ['pending', 'approved', 'closed', 'handed_over']
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    await db.items.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"status": request.status}}
    )
    
    return {"message": "Status updated", "status": request.status}

# ============== CLAIMS ENDPOINTS ==============

@api_router.post("/claims", response_model=ClaimResponse)
async def create_claim(claim: ClaimCreate, current_user: dict = Depends(get_current_user)):
    """Create a claim for an item"""
    try:
        item = await db.items.find_one({"_id": ObjectId(claim.item_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid item ID")
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item['status'] != 'approved':
        raise HTTPException(status_code=400, detail="Item is not available for claiming")
    
    if item['finder_id'] == str(current_user['_id']):
        raise HTTPException(status_code=400, detail="You cannot claim your own item")
    
    # Check if user already claimed this item
    existing_claim = await db.claims.find_one({
        "item_id": claim.item_id,
        "claimer_id": str(current_user['_id'])
    })
    if existing_claim:
        raise HTTPException(status_code=400, detail="You have already claimed this item")
    
    # Verify answers count matches questions count
    if len(claim.answers) != len(item.get('verification_questions', [])):
        raise HTTPException(status_code=400, detail="Please answer all verification questions")
    
    claim_data = {
        "item_id": claim.item_id,
        "claimer_id": str(current_user['_id']),
        "claimer_name": current_user['name'],
        "answers": claim.answers,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    result = await db.claims.insert_one(claim_data)
    
    # Create chat between finder and claimer
    chat_data = {
        "item_id": claim.item_id,
        "item_title": f"{item['category']} - {item['city']}",
        "finder_id": item['finder_id'],
        "finder_name": item['finder_name'],
        "claimer_id": str(current_user['_id']),
        "claimer_name": current_user['name'],
        "messages": [],
        "created_at": datetime.utcnow()
    }
    await db.chats.insert_one(chat_data)
    
    logger.info(f"New claim created for item {claim.item_id} by {current_user['phone']}")
    
    return ClaimResponse(
        id=str(result.inserted_id),
        item_id=claim.item_id,
        claimer_id=claim_data['claimer_id'],
        claimer_name=claim_data['claimer_name'],
        status=claim_data['status'],
        created_at=claim_data['created_at']
    )

@api_router.get("/claims", response_model=List[ClaimResponse])
async def get_claims(
    item_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get claims (for item finder or claimer)"""
    query = {
        "$or": [
            {"claimer_id": str(current_user['_id'])}
        ]
    }
    
    # If item_id provided, check if user is the finder
    if item_id:
        try:
            item = await db.items.find_one({"_id": ObjectId(item_id)})
            if item and item['finder_id'] == str(current_user['_id']):
                query = {"item_id": item_id}
        except:
            pass
    
    # Also get claims for items user owns
    user_items = await db.items.find({"finder_id": str(current_user['_id'])}).to_list(100)
    user_item_ids = [str(item['_id']) for item in user_items]
    query = {
        "$or": [
            {"claimer_id": str(current_user['_id'])},
            {"item_id": {"$in": user_item_ids}}
        ]
    }
    
    claims = await db.claims.find(query).sort("created_at", -1).to_list(100)
    
    return [
        ClaimResponse(
            id=str(claim['_id']),
            item_id=claim['item_id'],
            claimer_id=claim['claimer_id'],
            claimer_name=claim['claimer_name'],
            status=claim['status'],
            created_at=claim['created_at']
        )
        for claim in claims
    ]

@api_router.get("/claims/{claim_id}")
async def get_claim_detail(claim_id: str, current_user: dict = Depends(get_current_user)):
    """Get claim details with answers (only for item finder)"""
    try:
        claim = await db.claims.find_one({"_id": ObjectId(claim_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid claim ID")
    
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Get the item
    item = await db.items.find_one({"_id": ObjectId(claim['item_id'])})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Check if user is finder or claimer
    is_finder = item['finder_id'] == str(current_user['_id'])
    is_claimer = claim['claimer_id'] == str(current_user['_id'])
    
    if not is_finder and not is_claimer:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    response = {
        "id": str(claim['_id']),
        "item_id": claim['item_id'],
        "claimer_id": claim['claimer_id'],
        "claimer_name": claim['claimer_name'],
        "status": claim['status'],
        "created_at": claim['created_at']
    }
    
    # Only show answers to finder
    if is_finder:
        questions = item.get('verification_questions', [])
        answers = claim.get('answers', [])
        response['qa_pairs'] = [
            {"question": q['question'], "correct_answer": q['answer'], "given_answer": answers[i] if i < len(answers) else ""}
            for i, q in enumerate(questions)
        ]
    
    return response

@api_router.put("/claims/{claim_id}")
async def update_claim_status(
    claim_id: str,
    request: UpdateClaimStatusRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update claim status (approve/reject by finder)"""
    try:
        claim = await db.claims.find_one({"_id": ObjectId(claim_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid claim ID")
    
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Get the item
    item = await db.items.find_one({"_id": ObjectId(claim['item_id'])})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Only finder can approve/reject
    if item['finder_id'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Only item finder can update claim status")
    
    valid_statuses = ['pending', 'approved', 'rejected']
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    await db.claims.update_one(
        {"_id": ObjectId(claim_id)},
        {"$set": {"status": request.status}}
    )
    
    return {"message": "Claim status updated", "status": request.status}

# ============== CHAT ENDPOINTS ==============

@api_router.get("/chats", response_model=List[ChatResponse])
async def get_chats(current_user: dict = Depends(get_current_user)):
    """Get user's chat list"""
    query = {
        "$or": [
            {"finder_id": str(current_user['_id'])},
            {"claimer_id": str(current_user['_id'])}
        ]
    }
    
    chats = await db.chats.find(query).sort("created_at", -1).to_list(100)
    
    result = []
    for chat in chats:
        last_message = None
        last_message_at = None
        if chat.get('messages'):
            last_msg = chat['messages'][-1]
            last_message = last_msg.get('content', '')[:50]
            last_message_at = last_msg.get('created_at')
        
        result.append(ChatResponse(
            id=str(chat['_id']),
            item_id=chat['item_id'],
            item_title=chat.get('item_title', 'Item'),
            finder_id=chat['finder_id'],
            finder_name=chat['finder_name'],
            claimer_id=chat['claimer_id'],
            claimer_name=chat['claimer_name'],
            last_message=last_message,
            last_message_at=last_message_at,
            unread_count=0
        ))
    
    return result

@api_router.get("/chats/{chat_id}")
async def get_chat_messages(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Get chat messages"""
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid chat ID")
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Check if user is part of chat
    if chat['finder_id'] != str(current_user['_id']) and chat['claimer_id'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "id": str(chat['_id']),
        "item_id": chat['item_id'],
        "item_title": chat.get('item_title', 'Item'),
        "finder_id": chat['finder_id'],
        "finder_name": chat['finder_name'],
        "claimer_id": chat['claimer_id'],
        "claimer_name": chat['claimer_name'],
        "messages": chat.get('messages', [])
    }

@api_router.post("/chats/{chat_id}/messages")
async def send_message(
    chat_id: str,
    message: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Send a message in chat"""
    try:
        chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid chat ID")
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Check if user is part of chat
    if chat['finder_id'] != str(current_user['_id']) and chat['claimer_id'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_message = {
        "id": str(uuid.uuid4()),
        "sender_id": str(current_user['_id']),
        "sender_name": current_user['name'],
        "content": message.content,
        "created_at": datetime.utcnow()
    }
    
    await db.chats.update_one(
        {"_id": ObjectId(chat_id)},
        {"$push": {"messages": new_message}}
    )
    
    return new_message

# ============== REPORTS ENDPOINTS ==============

@api_router.post("/reports", response_model=ReportResponse)
async def create_report(report: ReportCreate, current_user: dict = Depends(get_current_user)):
    """Create abuse report"""
    reported_user_name = None
    if report.reported_user_id:
        try:
            reported_user = await db.users.find_one({"_id": ObjectId(report.reported_user_id)})
            if reported_user:
                reported_user_name = reported_user['name']
        except:
            pass
    
    report_data = {
        "reporter_id": str(current_user['_id']),
        "reporter_name": current_user['name'],
        "reported_user_id": report.reported_user_id,
        "reported_user_name": reported_user_name,
        "item_id": report.item_id,
        "reason": report.reason,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    result = await db.reports.insert_one(report_data)
    
    return ReportResponse(
        id=str(result.inserted_id),
        reporter_id=report_data['reporter_id'],
        reporter_name=report_data['reporter_name'],
        reported_user_id=report_data['reported_user_id'],
        reported_user_name=report_data['reported_user_name'],
        item_id=report_data['item_id'],
        reason=report_data['reason'],
        status=report_data['status'],
        created_at=report_data['created_at']
    )

# ============== ADMIN ENDPOINTS ==============

@api_router.get("/admin/stats", response_model=AdminStatsResponse)
async def get_admin_stats(current_user: dict = Depends(get_admin_user)):
    """Get admin dashboard statistics"""
    total_users = await db.users.count_documents({})
    total_items = await db.items.count_documents({})
    pending_items = await db.items.count_documents({"status": "pending"})
    approved_items = await db.items.count_documents({"status": "approved"})
    resolved_cases = await db.items.count_documents({"status": {"$in": ["closed", "handed_over"]}})
    pending_reports = await db.reports.count_documents({"status": "pending"})
    
    return AdminStatsResponse(
        total_users=total_users,
        total_items=total_items,
        pending_items=pending_items,
        approved_items=approved_items,
        resolved_cases=resolved_cases,
        pending_reports=pending_reports
    )

@api_router.get("/admin/users")
async def get_admin_users(current_user: dict = Depends(get_admin_user)):
    """Get all users (admin)"""
    users = await db.users.find().sort("created_at", -1).to_list(1000)
    return [serialize_user(user).dict() for user in users]

@api_router.put("/admin/users/{user_id}")
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    current_user: dict = Depends(get_admin_user)
):
    """Update user (block/unblock, change role)"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {}
    if request.blocked is not None:
        update_data['blocked'] = request.blocked
    if request.role is not None:
        if request.role not in ['user', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid role")
        update_data['role'] = request.role
    
    if update_data:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    
    return {"message": "User updated"}

@api_router.get("/admin/items")
async def get_admin_items(
    status: Optional[str] = None,
    current_user: dict = Depends(get_admin_user)
):
    """Get all items (admin)"""
    query = {}
    if status:
        query['status'] = status
    
    items = await db.items.find(query).sort("created_at", -1).to_list(1000)
    
    return [
        {
            "id": str(item['_id']),
            "finder_id": item['finder_id'],
            "finder_name": item['finder_name'],
            "category": item['category'],
            "city": item['city'],
            "location": item['location'],
            "date_found": item['date_found'],
            "description": item['description'],
            "images": item['images'],
            "status": item['status'],
            "created_at": item['created_at'].isoformat()
        }
        for item in items
    ]

@api_router.put("/admin/items/{item_id}")
async def admin_update_item(
    item_id: str,
    request: UpdateItemStatusRequest,
    current_user: dict = Depends(get_admin_user)
):
    """Update item status (admin)"""
    try:
        item = await db.items.find_one({"_id": ObjectId(item_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid item ID")
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    valid_statuses = ['pending', 'approved', 'closed', 'rejected']
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    await db.items.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"status": request.status}}
    )
    
    return {"message": "Item status updated", "status": request.status}

@api_router.get("/admin/reports")
async def get_admin_reports(current_user: dict = Depends(get_admin_user)):
    """Get all reports (admin)"""
    reports = await db.reports.find().sort("created_at", -1).to_list(1000)
    
    return [
        {
            "id": str(report['_id']),
            "reporter_id": report['reporter_id'],
            "reporter_name": report['reporter_name'],
            "reported_user_id": report.get('reported_user_id'),
            "reported_user_name": report.get('reported_user_name'),
            "item_id": report.get('item_id'),
            "reason": report['reason'],
            "status": report['status'],
            "created_at": report['created_at'].isoformat()
        }
        for report in reports
    ]

@api_router.put("/admin/reports/{report_id}")
async def update_report(
    report_id: str,
    request: UpdateReportStatusRequest,
    current_user: dict = Depends(get_admin_user)
):
    """Update report status (admin)"""
    try:
        report = await db.reports.find_one({"_id": ObjectId(report_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid report ID")
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    valid_statuses = ['pending', 'resolved', 'dismissed']
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    await db.reports.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"status": request.status}}
    )
    
    return {"message": "Report status updated", "status": request.status}

# ============== CATEGORIES ==============

@api_router.get("/categories")
async def get_categories():
    """Get list of item categories"""
    return {
        "categories": [
            "Mobile Phone",
            "Wallet",
            "Keys",
            "ID Card / Documents",
            "Bag / Backpack",
            "Laptop / Tablet",
            "Watch",
            "Jewelry",
            "Glasses / Sunglasses",
            "Clothing",
            "Electronics",
            "Pet",
            "Other"
        ]
    }

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
