from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import query, transaction
from app.security import get_current_user
from app.services.activity_logger import log_activity

router = APIRouter()


@router.post("", status_code=201)
def transfer(body: dict, user=Depends(get_current_user)):
    consumable_id = body.get("consumableId")
    from_facility_id = body.get("fromFacilityId")
    to_facility_id = body.get("toFacilityId")
    quantity = body.get("quantity")
    transferred_by = body.get("transferred_by")
    received_by = body.get("received_by")
    approved_by = body.get("approved_by")
    notes = body.get("notes")
    performed_by = user["name"] if user else transferred_by

    if not consumable_id or not from_facility_id or not to_facility_id or not quantity or not transferred_by:
        raise HTTPException(
            status_code=400, detail="consumableId, fromFacilityId, toFacilityId, quantity, transferred_by required"
        )
    if from_facility_id == to_facility_id:
        raise HTTPException(status_code=400, detail="Source and destination facilities must be different")

    try:
        with transaction() as cur:
            cur.execute("SELECT * FROM consumables WHERE id=%s FOR UPDATE", [consumable_id])
            consumables = cur.fetchall()
            if not consumables:
                raise HTTPException(status_code=404, detail="Consumable not found")
            if consumables[0]["stock"] < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {consumables[0]['stock']}")

            cur.execute("SELECT id, name FROM facilities WHERE id=%s", [from_facility_id])
            from_fac = cur.fetchall()
            if not from_fac:
                raise HTTPException(status_code=404, detail="Source facility not found")

            cur.execute("SELECT id, name FROM facilities WHERE id=%s", [to_facility_id])
            to_fac = cur.fetchall()
            if not to_fac:
                raise HTTPException(status_code=404, detail="Destination facility not found")

            cur.execute("UPDATE consumables SET stock=stock-%s, updated_at=NOW() WHERE id=%s", [quantity, consumable_id])

            cur.execute(
                """INSERT INTO stock_transfers (consumable_id, from_facility_id, to_facility_id, quantity, transferred_by, received_by, approved_by, notes)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                [consumable_id, from_facility_id, to_facility_id, quantity, transferred_by, received_by or "", approved_by or "", notes or ""],
            )
            log_row = cur.fetchall()[0]

        log_activity(
            "stock_transfer",
            log_row["id"],
            "transferred",
            performed_by,
            details=f"{consumables[0]['name']} ({quantity} units) transferred from {from_fac[0]['name']} to {to_fac[0]['name']}",
            changes={
                "consumable_id": consumable_id,
                "consumable_name": consumables[0]["name"],
                "from_facility": from_fac[0]["name"],
                "to_facility": to_fac[0]["name"],
                "quantity": quantity,
                "previous_stock": consumables[0]["stock"],
                "new_stock": consumables[0]["stock"] - quantity,
                "notes": notes or "",
            },
        )

        return {"transfer": log_row, "new_stock": consumables[0]["stock"] - quantity}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("")
def get_transfers(
    from_: str = Query(default=None, alias="from"),
    to: str = None,
    consumable_id: int = None,
    user=Depends(get_current_user),
):
    q = """
        SELECT st.*, c.name as consumable_name, f1.name as from_facility, f2.name as to_facility
        FROM stock_transfers st
        JOIN consumables c ON st.consumable_id = c.id
        JOIN facilities f1 ON st.from_facility_id = f1.id
        JOIN facilities f2 ON st.to_facility_id = f2.id
        WHERE 1=1
    """
    params = []
    if from_:
        params.append(from_)
        q += " AND st.transferred_at >= %s"
    if to:
        params.append(to)
        q += " AND st.transferred_at <= %s"
    if consumable_id:
        params.append(consumable_id)
        q += " AND st.consumable_id = %s"
    q += " ORDER BY st.transferred_at DESC"
    try:
        return query(q, params)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
