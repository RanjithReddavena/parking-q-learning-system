from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

app = FastAPI(title="Parking Q-Learning System")

# Enable CORS (frontend connection)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routes
app.include_router(router)


# Root endpoint
@app.get("/")
def root():
    return {"message": "Parking Q-Learning API is running 🚀"}


#uvicorn app.main:app --reload