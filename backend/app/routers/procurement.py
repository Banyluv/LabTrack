from fastapi import APIRouter, Depends, HTTPException

from app.db import query, transaction
from app.excel_utils import xlsx_response
from app.security import get_current_user
from app.services.activity_logger import log_activity

router = APIRouter()

ITEMS_SUBQUERY = """
        (SELECT json_agg(json_build_object(
          'id', poi.id,
          'consumable_id', poi.consumable_id,
          'consumable_name', c2.name,
          'quantity', poi.quantity,
          'cost', poi.cost
        ){order_by}) FROM procurement_order_items poi
        JOIN consumables c2 ON poi.consumable_id = c2.id
        WHERE poi.order_id = po.id) as items
"""


@router.post("", status_code=201)
def create_order(body: dict, user=Depends(get_current_user)):
    supplier_id = body.get("supplierId")
    items = body.get("items")
    notes = body.get("notes")
    performed_by = user["name"] if user else "System"

    if not supplier_id or not items or not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status_code=400, detail="supplierId and items (array) are required")
    for item in items:
        if not item.get("consumableId") or not item.get("quantity"):
            raise HTTPException(status_code=400, detail="Each item must have consumableId and quantity")

    try:
        with transaction() as cur:
            cur.execute("SELECT * FROM suppliers WHERE id=%s", [supplier_id])
            supp_res = cur.fetchall()
            if not supp_res:
                raise HTTPException(status_code=404, detail="Supplier not found")
            supplier_name = supp_res[0]["name"]

            cur.execute(
                "INSERT INTO procurement_orders (supplier_id, status, notes) VALUES (%s, 'pending', %s) RETURNING *",
                [supplier_id, notes or ""],
            )
            order_id = cur.fetchall()[0]["id"]

            consumable_names = []
            for item in items:
                cur.execute("SELECT * FROM consumables WHERE id=%s FOR UPDATE", [item["consumableId"]])
                cons_res = cur.fetchall()
                if not cons_res:
                    raise HTTPException(status_code=404, detail=f"Consumable with id {item['consumableId']} not found")
                consumable_names.append(cons_res[0]["name"])

                cur.execute(
                    "INSERT INTO procurement_order_items (order_id, consumable_id, quantity, cost) VALUES (%s, %s, %s, %s)",
                    [order_id, item["consumableId"], item["quantity"], item.get("cost") or 0],
                )

            item_details = ", ".join(f"{consumable_names[i]} ({it['quantity']} units)" for i, it in enumerate(items))

        log_activity(
            "procurement",
            order_id,
            "created",
            performed_by,
            details=f"Purchase order #{order_id} created with {len(items)} item(s): {item_details} from {supplier_name}",
            changes={
                "supplier": supplier_name,
                "items": [
                    {
                        "consumable": consumable_names[i],
                        "consumable_id": it["consumableId"],
                        "quantity": it["quantity"],
                        "cost": it.get("cost") or 0,
                    }
                    for i, it in enumerate(items)
                ],
                "status": "pending",
                "notes": notes or "",
            },
        )

        full_order = query(
            f"""
            SELECT po.*, s.name as supplier_name,
              {ITEMS_SUBQUERY.format(order_by="")}
            FROM procurement_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            WHERE po.id = %s
            """,
            [order_id],
        )
        return full_order[0]
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/export")
def export_excel(user=Depends(get_current_user)):
    try:
        rows = query(
            """
            SELECT po.id, po.created_at, s.name as supplier_name, po.status, po.notes, po.updated_at
            FROM procurement_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            ORDER BY po.created_at DESC
            """
        )

        order_ids = [r["id"] for r in rows]
        items_map = {}
        if order_ids:
            all_items = query(
                """
                SELECT poi.order_id, poi.consumable_id, c.name as consumable_name, poi.quantity, poi.cost
                FROM procurement_order_items poi
                JOIN consumables c ON poi.consumable_id = c.id
                WHERE poi.order_id = ANY(%s)
                ORDER BY poi.order_id, poi.id
                """,
                [order_ids],
            )
            for item in all_items:
                items_map.setdefault(item["order_id"], []).append(item)

        export_rows = []
        for row in rows:
            items = items_map.get(row["id"], [])
            items_str = " | ".join(
                f"{it['consumable_name']} (Qty: {it['quantity']}, Cost: ₦{float(it['cost'] or 0):,.2f})" for it in items
            ) or "—"
            export_rows.append(
                {
                    **row,
                    "items": items_str,
                    "created_at": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row["created_at"] else "",
                    "updated_at": row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row["updated_at"] else "",
                }
            )

        columns = [
            ("Order ID", "id", 10),
            ("Created At", "created_at", 22),
            ("Supplier", "supplier_name", 22),
            ("Items", "items", 50),
            ("Status", "status", 16),
            ("Notes", "notes", 30),
            ("Updated At", "updated_at", 22),
        ]
        return xlsx_response("procurement-orders.xlsx", "Procurement Orders", columns, export_rows)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("")
def get_orders(user=Depends(get_current_user)):
    try:
        return query(
            f"""
            SELECT po.*, s.name as supplier_name,
              {ITEMS_SUBQUERY.format(order_by="")}
            FROM procurement_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            ORDER BY po.created_at DESC
            """
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/{id}")
def update_order_status(id: int, body: dict, user=Depends(get_current_user)):
    status = body.get("status")
    performed_by = user["name"] if user else "System"
    if status not in ("pending", "ordered", "received", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status. Must be pending, ordered, received, or cancelled")

    try:
        with transaction() as cur:
            cur.execute(
                f"""
                SELECT po.*, s.name as supplier_name,
                  {ITEMS_SUBQUERY.format(order_by=" ORDER BY poi.id")}
                FROM procurement_orders po
                JOIN suppliers s ON po.supplier_id = s.id
                WHERE po.id = %s FOR UPDATE
                """,
                [id],
            )
            rows = cur.fetchall()
            if not rows:
                raise HTTPException(status_code=404, detail="Order not found")

            order = rows[0]
            old_status = order["status"]
            order_items = order["items"] or []

            stock_snapshots = {}
            for item in order_items:
                cur.execute("SELECT stock FROM consumables WHERE id=%s", [item["consumable_id"]])
                cons = cur.fetchall()
                stock_snapshots[item["consumable_id"]] = cons[0]["stock"] if cons else 0

            if status == "received" and order["status"] != "received":
                for item in order_items:
                    cur.execute(
                        "UPDATE consumables SET stock=stock+%s, updated_at=NOW() WHERE id=%s",
                        [item["quantity"], item["consumable_id"]],
                    )
            if status != "received" and order["status"] == "received":
                for item in order_items:
                    cur.execute("SELECT stock FROM consumables WHERE id=%s", [item["consumable_id"]])
                    cons = cur.fetchall()
                    if cons and cons[0]["stock"] >= item["quantity"]:
                        cur.execute(
                            "UPDATE consumables SET stock=stock-%s, updated_at=NOW() WHERE id=%s",
                            [item["quantity"], item["consumable_id"]],
                        )

            cur.execute(
                "UPDATE procurement_orders SET status=%s, updated_at=NOW() WHERE id=%s RETURNING *",
                [status, id],
            )
            cur.fetchall()

        item_details = "; ".join(
            f"{it['consumable_name']}: {it['quantity']} units (prev stock: {stock_snapshots.get(it['consumable_id'], 0)})"
            for it in order_items
        )

        log_activity(
            "procurement",
            id,
            "status_changed",
            performed_by,
            details=f"Purchase order #{id} status changed from '{old_status}' to '{status}'. Items: {item_details}",
            changes={
                "supplier": order["supplier_name"],
                "items": [
                    {
                        "consumable": it["consumable_name"],
                        "consumable_id": it["consumable_id"],
                        "quantity": it["quantity"],
                        "previous_stock": stock_snapshots.get(it["consumable_id"], 0),
                        "new_stock": (
                            stock_snapshots.get(it["consumable_id"], 0) + it["quantity"]
                            if status == "received" and old_status != "received"
                            else stock_snapshots.get(it["consumable_id"], 0)
                        ),
                    }
                    for it in order_items
                ],
                "previous_status": old_status,
                "new_status": status,
            },
        )

        full_order = query(
            f"""
            SELECT po.*, s.name as supplier_name,
              {ITEMS_SUBQUERY.format(order_by=" ORDER BY poi.id")}
            FROM procurement_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            WHERE po.id = %s
            """,
            [id],
        )
        return full_order[0]
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
