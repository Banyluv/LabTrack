from fastapi import APIRouter, Depends, HTTPException

from app.db import query
from app.security import get_current_user

router = APIRouter()


@router.get("")
def get_notifications(limit: int = 20, offset: int = 0, user=Depends(get_current_user)):
    user_id = user["id"]
    try:
        total = query("SELECT COUNT(*) as total FROM notifications WHERE user_id = %s", [user_id])[0]["total"]
        rows = query(
            """SELECT n.*, u.name as actor_name
               FROM notifications n
               LEFT JOIN users u ON (n.data->>'performed_by') = u.name
               WHERE n.user_id = %s
               ORDER BY n.created_at DESC
               LIMIT %s OFFSET %s""",
            [user_id, limit, offset],
        )
        return {"notifications": rows, "total": int(total), "limit": limit, "offset": offset}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/unread-count")
def get_unread_count(user=Depends(get_current_user)):
    try:
        rows = query(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = %s AND is_read = false",
            [user["id"]],
        )
        return {"unread_count": int(rows[0]["count"])}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/read-all")
def mark_all_as_read(user=Depends(get_current_user)):
    try:
        query(
            "UPDATE notifications SET is_read = true WHERE user_id = %s AND is_read = false",
            [user["id"]],
        )
        return {"success": True}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/{id}/read")
def mark_as_read(id: int, user=Depends(get_current_user)):
    try:
        query("UPDATE notifications SET is_read = true WHERE id = %s AND user_id = %s", [id, user["id"]])
        return {"success": True}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.delete("/{id}")
def delete_notification(id: int, user=Depends(get_current_user)):
    try:
        query("DELETE FROM notifications WHERE id = %s AND user_id = %s", [id, user["id"]])
        return {"success": True}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
