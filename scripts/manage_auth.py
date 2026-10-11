#!/usr/bin/env python3
"""
Secure User & Password Management CLI
Allows administrators to bootstrap or update user credentials directly on the server host.
Uses Argon2id password hashing.
"""
import sys
import os
import secrets
import string
from argon2 import PasswordHasher

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.database import SessionLocal
from backend.app.models import User

ph = PasswordHasher()

def generate_secure_password(length=16):
    chars = string.ascii_letters + string.digits + "!@#$%^&*-_"
    return "".join(secrets.choice(chars) for _ in range(length))

def set_password(username: str, password: str = None):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"Error: User '{username}' does not exist.")
            return False

        if not password:
            password = generate_secure_password()
            generated = True
        else:
            generated = False

        user.password_hash = ph.hash(password)
        db.commit()
        print(f"Successfully set Argon2id password hash for '{username}'.")
        if generated:
            print(f"Generated Password: {password}")
        return True
    finally:
        db.close()

def bootstrap_all_users():
    """Initializes Argon2id password hashes for existing users if not set."""
    db = SessionLocal()
    try:
        # Load from environment or fallback to secure defaults for initial test accounts
        env_passwords = {
            "admin": os.environ.get("ADMIN_PASSWORD", "Admin@Foundation2026!"),
            "officer": os.environ.get("OFFICER_PASSWORD", "Officer@Foundation2026!"),
            "finance": os.environ.get("FINANCE_PASSWORD", "Finance@Foundation2026!"),
            "viewer": os.environ.get("VIEWER_PASSWORD", "Viewer@Foundation2026!"),
        }

        users = db.query(User).all()
        for u in users:
            if not u.password_hash or os.environ.get("FORCE_RESET_PASSWORDS"):
                pwd = env_passwords.get(u.username)
                if not pwd:
                    pwd = generate_secure_password()
                    print(f"Generated secure password for {u.username}: {pwd}")
                u.password_hash = ph.hash(pwd)
                print(f"Initialized password hash for user '{u.username}'.")
        db.commit()
        print("All users initialized with secure Argon2id hashes.")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "bootstrap":
        bootstrap_all_users()
    elif len(sys.argv) >= 3:
        username = sys.argv[1]
        password = sys.argv[2]
        set_password(username, password)
    elif len(sys.argv) == 2:
        username = sys.argv[1]
        set_password(username)
    else:
        print("Usage:")
        print("  python3 scripts/manage_auth.py bootstrap")
        print("  python3 scripts/manage_auth.py <username> <new_password>")
        print("  python3 scripts/manage_auth.py <username> (generates random password)")
