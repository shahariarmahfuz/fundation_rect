from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi.staticfiles import StaticFiles
from backend.app.routers import auth, groups, members, beneficiaries, donations, sadaqah, qard_hasan, contributions, settings

app = FastAPI(
    title="Foundation Management System API",
    version="1.0.0",
    description="Backend API for Foundation Management System supporting Group, Member, Beneficiary, Donation, Sadaqah, Qard Hasan, Contribution modules and RBAC."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for public uploads
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "public", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(members.router)
app.include_router(beneficiaries.router)
app.include_router(donations.router)
app.include_router(sadaqah.router)
app.include_router(qard_hasan.router)
app.include_router(contributions.router)
app.include_router(settings.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "system": "Foundation Management System"}
