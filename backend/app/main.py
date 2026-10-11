from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.routers import auth, groups, members, beneficiaries, donations

app = FastAPI(
    title="Foundation Management System API",
    version="1.0.0",
    description="Backend API for Foundation Management System supporting Group, Member, Beneficiary, Donation modules and RBAC."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(members.router)
app.include_router(beneficiaries.router)
app.include_router(donations.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "system": "Foundation Management System"}
