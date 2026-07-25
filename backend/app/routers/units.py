from fastapi import APIRouter, Depends, HTTPException

from app.db import query
from app.security import admin_only, get_current_user

router = APIRouter()


@router.get("")
def get_all(user=Depends(get_current_user)):
    try:
        return query("SELECT * FROM units ORDER BY name")
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/{id}")
def get_one(id: int, user=Depends(get_current_user)):
    try:
        rows = query("SELECT * FROM units WHERE id = %s", [id])
        if not rows:
            raise HTTPException(status_code=404, detail="Not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.post("", status_code=201)
def create(body: dict, user=Depends(admin_only)):
    name = body.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Unit name is required")
    try:
        rows = query("INSERT INTO units (name) VALUES (%s) RETURNING *", [name])
        return rows[0]
    except Exception as err:
        if getattr(err, "pgcode", None) == "23505":
            raise HTTPException(status_code=400, detail="Unit already exists")
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/{id}")
def update(id: int, body: dict, user=Depends(admin_only)):
    name = body.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Unit name is required")
    try:
        rows = query("UPDATE units SET name = %s WHERE id = %s RETURNING *", [name, id])
        if not rows:
            raise HTTPException(status_code=404, detail="Not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as err:
        if getattr(err, "pgcode", None) == "23505":
            raise HTTPException(status_code=400, detail="Unit already exists")
        raise HTTPException(status_code=500, detail=str(err))


@router.delete("/{id}")
def delete(id: int, user=Depends(admin_only)):
    try:
        query("DELETE FROM units WHERE id = %s", [id])
        return {"message": "Deleted"}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
