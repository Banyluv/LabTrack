from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import query, transaction
from app.security import get_current_user
from app.services.activity_logger import log_activity

router = APIRouter()


@router.post("", status_code=201)
def log_usage(body: dict, user=Depends(get_current_user)):
    consumable_id = body.get("consumable_id")
    quantity = body.get("quantity")
    used_by = body.get("used_by")
    notes = body.get("notes")
    batch_no = body.get("batch_no")
    expiry_date = body.get("expiry_date")

    if not consumable_id or not quantity or not used_by:
        raise HTTPException(status_code=400, detail="consumable_id, quantity, used_by are required")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be a positive number")

    try:
        with transaction() as cur:
            cur.execute("SELECT * FROM consumables WHERE id=%s FOR UPDATE", [consumable_id])
            rows = cur.fetchall()
            if not rows:
                raise HTTPException(status_code=404, detail="Consumable not found")
            if rows[0]["stock"] < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {rows[0]['stock']}")

            prev_stock = rows[0]["stock"]
            consumable_name = rows[0]["name"]

            cur.execute("UPDATE consumables SET stock=stock-%s, updated_at=NOW() WHERE id=%s", [quantity, consumable_id])

            usage_date = body.get("usage_date") or date.today().isoformat()

            cur.execute(
                """INSERT INTO daily_usage_logs (consumable_id, quantity, used_by, notes, batch_no, expiry_date, usage_date)
                   VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                [consumable_id, quantity, used_by, notes or "", batch_no or "", expiry_date or None, usage_date],
            )
            log_row = cur.fetchall()[0]

        log_activity(
            "daily_usage",
            log_row["id"],
            "logged",
            user["name"] if user else used_by,
            details=f"{consumable_name}: {quantity} units used by {used_by} on {usage_date}",
            changes={
                "consumable_id": consumable_id,
                "consumable_name": consumable_name,
                "quantity": quantity,
                "used_by": used_by,
                "usage_date": usage_date,
                "previous_stock": prev_stock,
                "new_stock": prev_stock - quantity,
                "notes": notes or "",
            },
        )

        return {"log": log_row, "new_stock": prev_stock - quantity}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("")
def get_logs(
    from_: str = Query(default=None, alias="from"),
    to: str = None,
    consumable_id: int = None,
    used_by: str = None,
    limit: int = None,
    user=Depends(get_current_user),
):
    q = """
        SELECT dul.*, c.name as consumable_name, cat.name as category_name, u.name as unit_name
        FROM daily_usage_logs dul
        JOIN consumables c ON dul.consumable_id = c.id
        JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN units u ON c.unit = u.name
        WHERE 1=1
    """
    params = []
    if from_:
        params.append(from_)
        q += " AND dul.usage_date >= %s"
    if to:
        params.append(to)
        q += " AND dul.usage_date <= %s"
    if consumable_id:
        params.append(consumable_id)
        q += " AND dul.consumable_id = %s"
    if used_by:
        params.append(f"%{used_by}%")
        q += " AND dul.used_by ILIKE %s"
    q += " ORDER BY dul.usage_date DESC, dul.created_at DESC"
    if limit:
        params.append(limit)
        q += " LIMIT %s"
    try:
        return query(q, params)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/today")
def get_today_summary(user=Depends(get_current_user)):
    try:
        rows = query(
            """
            SELECT
              COUNT(*) as total_entries,
              COALESCE(SUM(dul.quantity), 0) as total_units_used,
              COUNT(DISTINCT dul.consumable_id) as unique_items,
              COUNT(DISTINCT dul.used_by) as unique_users,
              json_agg(json_build_object(
                'id', dul.id,
                'consumable_name', c.name,
                'category_name', cat.name,
                'unit', u.name,
                'quantity', dul.quantity,
                'used_by', dul.used_by,
                'notes', dul.notes,
                'batch_no', dul.batch_no,
                'expiry_date', dul.expiry_date,
                'usage_date', dul.usage_date,
                'created_at', dul.created_at
              ) ORDER BY dul.created_at DESC) as entries
            FROM daily_usage_logs dul
            JOIN consumables c ON dul.consumable_id = c.id
            JOIN categories cat ON c.category_id = cat.id
            LEFT JOIN units u ON c.unit = u.name
            WHERE dul.usage_date = CURRENT_DATE
            """
        )
        summary = rows[0] if rows else {
            "total_entries": 0,
            "total_units_used": 0,
            "unique_items": 0,
            "unique_users": 0,
            "entries": [],
        }
        if summary.get("entries") is None:
            summary["entries"] = []
        return summary
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.delete("/{id}")
def delete_log(id: int, user=Depends(get_current_user)):
    try:
        with transaction() as cur:
            cur.execute("SELECT * FROM daily_usage_logs WHERE id=%s FOR UPDATE", [id])
            rows = cur.fetchall()
            if not rows:
                raise HTTPException(status_code=404, detail="Usage log not found")

            log_row = rows[0]
            cur.execute(
                "UPDATE consumables SET stock=stock+%s, updated_at=NOW() WHERE id=%s",
                [log_row["quantity"], log_row["consumable_id"]],
            )
            cur.execute("DELETE FROM daily_usage_logs WHERE id=%s", [id])

        return {"message": "Usage log deleted and stock restored", "restored_quantity": log_row["quantity"]}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
