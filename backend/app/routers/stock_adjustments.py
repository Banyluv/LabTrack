from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import query, transaction
from app.security import admin_only, get_current_user
from app.services.activity_logger import log_activity

router = APIRouter()

ADJ_TYPES = ["loss", "expired", "damaged", "positive_adjustment_from", "negative_adjustment_to"]
STOCK_INCREASE_TYPES = ["positive_adjustment_from"]


@router.post("", status_code=201)
def create(body: dict, user=Depends(admin_only)):
    consumable_id = body.get("consumable_id")
    quantity = body.get("quantity")
    reason = body.get("reason")
    adjustment_type = body.get("adjustment_type")
    performed_by = user["name"] if user else "System"

    if not consumable_id or not quantity or not adjustment_type:
        raise HTTPException(status_code=400, detail="consumable_id, quantity, adjustment_type required")
    if adjustment_type not in ADJ_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid adjustment_type. Must be one of: {', '.join(ADJ_TYPES)}")

    qty = abs(int(quantity))
    try:
        with transaction() as cur:
            cur.execute("SELECT * FROM consumables WHERE id=%s FOR UPDATE", [consumable_id])
            rows = cur.fetchall()
            if not rows:
                raise HTTPException(status_code=404, detail="Consumable not found")
            prev_stock = rows[0]["stock"]
            consumable_name = rows[0]["name"]
            new_stock = prev_stock + qty if adjustment_type in STOCK_INCREASE_TYPES else prev_stock - qty
            if new_stock < 0:
                raise HTTPException(status_code=400, detail="Adjustment would result in negative stock")

            cur.execute("UPDATE consumables SET stock=%s, updated_at=NOW() WHERE id=%s", [new_stock, consumable_id])
            cur.execute(
                """INSERT INTO stock_adjustments (consumable_id, quantity, adjustment_type, reason, previous_stock, new_stock, performed_by)
                   VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                [consumable_id, qty, adjustment_type, reason or "", prev_stock, new_stock, performed_by],
            )
            log_row = cur.fetchall()[0]

        log_activity(
            "stock_adjustment",
            log_row["id"],
            "adjusted",
            performed_by,
            details=f"{consumable_name} stock {adjustment_type} of {qty} units ({prev_stock} → {new_stock})" + (f": {reason}" if reason else ""),
            changes={
                "consumable_id": consumable_id,
                "consumable_name": consumable_name,
                "quantity": qty,
                "adjustment_type": adjustment_type,
                "reason": reason or "",
                "previous_stock": prev_stock,
                "new_stock": new_stock,
            },
        )

        return {"adjustment": log_row, "new_stock": new_stock}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("")
def get_all(
    from_: str = Query(default=None, alias="from"),
    to: str = None,
    consumable_id: int = None,
    type: str = None,
    user=Depends(get_current_user),
):
    q = """
        SELECT sa.*, c.name as consumable_name, cat.name as category_name, c.unit
        FROM stock_adjustments sa
        JOIN consumables c ON sa.consumable_id = c.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        WHERE 1=1
    """
    params = []
    if from_:
        params.append(from_)
        q += " AND sa.created_at >= %s"
    if to:
        params.append(to)
        q += " AND sa.created_at <= %s"
    if consumable_id:
        params.append(consumable_id)
        q += " AND sa.consumable_id = %s"
    if type:
        params.append(type)
        q += " AND sa.adjustment_type = %s"
    q += " ORDER BY sa.created_at DESC LIMIT 200"
    try:
        return query(q, params)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
