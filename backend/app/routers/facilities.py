from fastapi import APIRouter, Depends, HTTPException

from app.db import query
from app.security import admin_only

router = APIRouter()


@router.get("")
def get_all():
    try:
        return query("SELECT * FROM facilities ORDER BY name")
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/{id}")
def get_one(id: int):
    try:
        rows = query("SELECT * FROM facilities WHERE id = %s", [id])
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
        raise HTTPException(status_code=400, detail="Facility name is required")
    try:
        rows = query(
            "INSERT INTO facilities (name, state, lga) VALUES (%s,%s,%s) RETURNING *",
            [name, body.get("state") or "", body.get("lga") or ""],
        )
        return rows[0]
    except Exception as err:
        if getattr(err, "pgcode", None) == "23505":
            raise HTTPException(status_code=400, detail="Facility already exists")
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/{id}")
def update(id: int, body: dict, user=Depends(admin_only)):
    name = body.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Facility name is required")
    try:
        rows = query(
            "UPDATE facilities SET name = %s, state = %s, lga = %s WHERE id = %s RETURNING *",
            [name, body.get("state") or "", body.get("lga") or "", id],
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as err:
        if getattr(err, "pgcode", None) == "23505":
            raise HTTPException(status_code=400, detail="Facility already exists")
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/{id}/toggle-status")
def toggle_status(id: int, user=Depends(admin_only)):
    try:
        rows = query(
            "UPDATE facilities SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END WHERE id = %s RETURNING *",
            [id],
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.delete("/{id}")
def delete(id: int, user=Depends(admin_only)):
    try:
        query("DELETE FROM facilities WHERE id = %s", [id])
        return {"message": "Deleted"}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
