from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import all routers
from api.routes import router as api_router
from api.chat_routes import router as chat_router
from api.admin_routes import router as admin_router
from api.payment_routes import router as payment_router
from api.contact_routes import router as contact_router
from api.voice_routes import router as voice_router
from api.websocket_manager import manager

app = FastAPI(
    title="TravelMaster V2 Agent Service",
    description="AI Agent backend for TravelMaster V2",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(api_router)
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(payment_router)
app.include_router(contact_router)
app.include_router(voice_router)

# Health checks
@app.get("/")
async def root():
    return {
        "message": "TravelMaster V2 Agent Service is running."
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }

# Initialize WebSocket manager on startup
@app.on_event("startup")
async def startup():
    await manager.startup()

@app.on_event("shutdown")
async def shutdown():
    await manager.shutdown()