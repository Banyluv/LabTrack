from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import query
from app.security import admin_only, get_current_user

router = APIRouter()


@router.get("")
def get_activity_logs(
    entity_type: str = None,
    entity_id: int = None,
    action: str = None,
    from_: str = Query(default=None, alias="from"),
    to: str = None,
    search: str = None,
    limit: int = 100,
    offset: int = 0,
    user=Depends(admin_only),
):
    role = user.get("role")
    name = user.get("name")

    where = "1=1"
    params = []

    if role == "staff":
        params.append(name)
        where += f" AND al.performed_by = %s"
    if entity_type:
        params.append(entity_type)
        where += " AND al.entity_type = %s"
    if entity_id:
        params.append(entity_id)
        where += " AND al.entity_id = %s"
    if action:
        params.append(action)
        where += " AND al.action = %s"
    if from_:
        params.append(from_)
        where += " AND al.created_at >= %s::timestamp"
    if to:
        params.append(to)
        where += " AND al.created_at <= %s::timestamp"
    if search:
        params.append(f"%{search}%")
        where += " AND (al.details ILIKE %s OR al.performed_by ILIKE %s)"
        params.append(f"%{search}%")

    try:
        total = query(f"SELECT COUNT(*) as total FROM activity_logs al WHERE {where}", params)[0]["total"]
        data_params = params + [limit, offset]
        rows = query(
            f"SELECT al.* FROM activity_logs al WHERE {where} ORDER BY al.created_at DESC LIMIT %s OFFSET %s",
            data_params,
        )
        return {"logs": rows, "total": int(total), "limit": limit, "offset": offset}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/types")
def get_entity_types(user=Depends(admin_only)):
    try:
        return query("SELECT DISTINCT entity_type, COUNT(*) as count FROM activity_logs GROUP BY entity_type ORDER BY entity_type")
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/{entity_type}")
def get_entity_type_history(entity_type: str, limit: int = 50, offset: int = 0, user=Depends(get_current_user)):
    role = user.get("role")
    name = user.get("name")
    params = [entity_type]
    where = "al.entity_type = %s"
    if role == "staff":
        params.append(name)
        where += " AND al.performed_by = %s"
    try:
        total = query(f"SELECT COUNT(*) as total FROM activity_logs al WHERE {where}", params)[0]["total"]
        data_params = params + [limit, offset]
        rows = query(
            f"SELECT al.* FROM activity_logs al WHERE {where} ORDER BY al.created_at DESC LIMIT %s OFFSET %s",
            data_params,
        )
        return {"logs": rows, "total": int(total), "limit": limit, "offset": offset}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/{entity_type}/{entity_id}")
def get_entity_history(entity_type: str, entity_id: int, user=Depends(get_current_user)):
    role = user.get("role")
    name = user.get("name")
    params = [entity_type, entity_id]
    where = "al.entity_type = %s AND al.entity_id = %s"
    if role == "staff":
        params.append(name)
        where += " AND al.performed_by = %s"
    try:
        return query(f"SELECT al.* FROM activity_logs al WHERE {where} ORDER BY al.created_at DESC", params)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
