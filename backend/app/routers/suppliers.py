from fastapi import APIRouter, Depends, HTTPException

from app.db import query
from app.security import admin_only

router = APIRouter()


@router.get("")
def get_all():
    try:
        return query("SELECT * FROM suppliers ORDER BY name")
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.post("", status_code=201)
def create(body: dict, user=Depends(admin_only)):
    name = body.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Supplier name is required")
    try:
        rows = query(
            "INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES (%s,%s,%s,%s,%s) RETURNING *",
            [name, body.get("contact_person") or "", body.get("email") or "", body.get("phone") or "", body.get("address") or ""],
        )
        return rows[0]
    except Exception as err:
        if getattr(err, "pgcode", None) == "23505":
            raise HTTPException(status_code=400, detail="Supplier already exists")
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/{id}")
def update(id: int, body: dict, user=Depends(admin_only)):
    name = body.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Supplier name is required")
    try:
        rows = query(
            "UPDATE suppliers SET name=%s, contact_person=%s, email=%s, phone=%s, address=%s WHERE id=%s RETURNING *",
            [name, body.get("contact_person") or "", body.get("email") or "", body.get("phone") or "", body.get("address") or "", id],
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as err:
        if getattr(err, "pgcode", None) == "23505":
            raise HTTPException(status_code=400, detail="Supplier already exists")
        raise HTTPException(status_code=500, detail=str(err))


@router.delete("/{id}")
def delete(id: int, user=Depends(admin_only)):
    try:
        query("DELETE FROM suppliers WHERE id=%s", [id])
        return {"message": "Deleted"}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
