from fastapi import FastAPI

app = FastAPI(
    title="TravelMaster V2 MLOps Service",
    description="Business logic backend for TravelMaster V2",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {
        "message": "TravelMaster V2 MLOps Service is running."
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }