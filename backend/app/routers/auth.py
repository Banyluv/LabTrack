from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException

from app.db import query
from app.security import create_token, get_current_user, hash_password, verify_password
from app.services.email_service import send_email
import os

router = APIRouter()


@router.post("/login")
def login(body: dict):
    username = body.get("username")
    password = body.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    try:
        rows = query("SELECT * FROM users WHERE name = %s", [username])
        if not rows:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        user = rows[0]
        if not verify_password(password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_token(
            {
                "id": user["id"],
                "email": user["email"],
                "role": user["role"],
                "name": user["name"],
                "facility_name": user["facility_name"],
            }
        )
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "facility_name": user["facility_name"],
            },
        }
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.post("/register", status_code=201)
def register(body: dict):
    name = body.get("name")
    email = body.get("email")
    password = body.get("password")
    role = body.get("role")
    facility_name = body.get("facility_name")
    state = body.get("state")
    lga = body.get("lga")

    user_email = email or f"{(name or facility_name or 'user').lower().replace(' ', '.')}@labtrack.local"
    if not name or not password:
        raise HTTPException(status_code=400, detail="Name and password are required")
    try:
        rows = query(
            """INSERT INTO users (name, email, password, role, facility_name, state, lga)
               VALUES (%s,%s,%s,%s,%s,%s,%s)
               RETURNING id,name,email,role,facility_name,state,lga""",
            [name, user_email, hash_password(password), role or "staff", facility_name or "", state or "", lga or ""],
        )
        return {"user": rows[0]}
    except HTTPException:
        raise
    except Exception as err:
        if getattr(err, "pgcode", None) == "23505":
            raise HTTPException(status_code=400, detail="Email already exists")
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/me")
def me(user=Depends(get_current_user)):
    try:
        rows = query(
            "SELECT id,name,email,role,facility_name,state,lga,created_at FROM users WHERE id=%s",
            [user["id"]],
        )
        return rows[0] if rows else None
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/profile")
def update_profile(body: dict, user=Depends(get_current_user)):
    name = body.get("name")
    email = body.get("email")
    facility_name = body.get("facility_name")
    state = body.get("state")
    lga = body.get("lga")
    try:
        rows = query(
            """UPDATE users SET name = COALESCE(%s, name), email = COALESCE(%s, email),
               facility_name = COALESCE(%s, facility_name), state = COALESCE(%s, state), lga = COALESCE(%s, lga)
               WHERE id = %s
               RETURNING id, name, email, role, facility_name, state, lga""",
            [name or None, email or None, facility_name or None, state or None, lga or None, user["id"]],
        )
        if not rows:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": "Profile updated", "user": rows[0]}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/change-password")
def change_password(body: dict, user=Depends(get_current_user)):
    current_password = body.get("currentPassword")
    new_password = body.get("newPassword")
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new password required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    try:
        rows = query("SELECT password FROM users WHERE id = %s", [user["id"]])
        if not rows:
            raise HTTPException(status_code=404, detail="User not found")
        if not verify_password(current_password, rows[0]["password"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        query("UPDATE users SET password = %s WHERE id = %s", [hash_password(new_password), user["id"]])
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/users")
def list_users(user=Depends(get_current_user)):
    try:
        return query(
            "SELECT id, name, email, role, facility_name, state, lga, status, created_at FROM users ORDER BY name"
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/users/{user_id}/toggle-status")
def toggle_user_status(user_id: int, user=Depends(get_current_user)):
    try:
        rows = query(
            """UPDATE users SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END
               WHERE id = %s RETURNING id, name, email, role, status""",
            [user_id],
        )
        if not rows:
            raise HTTPException(status_code=404, detail="User not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.post("/forgot-password")
def forgot_password(body: dict):
    email = body.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    try:
        rows = query("SELECT * FROM users WHERE email = %s", [email])
        if not rows:
            raise HTTPException(status_code=404, detail="User not found")

        reset_token = create_token({"id": rows[0]["id"], "email": email}, expires_in="1h")
        reset_link = f"{os.environ.get('FRONTEND_URL', 'http://localhost:5173')}/reset-password/{reset_token}"

        send_email(
            email,
            "LabTrack Password Reset",
            f"""
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="{reset_link}">{reset_link}</a>
            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            """,
        )

        return {"message": "Password reset link sent to your email"}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.post("/reset-password")
def reset_password(body: dict):
    token = body.get("token")
    password = body.get("password")
    if not token or not password:
        raise HTTPException(status_code=400, detail="Token and password required")
    try:
        decoded = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
        query("UPDATE users SET password = %s WHERE id = %s", [hash_password(password), decoded["id"]])
        return {"message": "Password reset successfully"}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
