import csv
import io
import os
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.db import query
from app.excel_utils import xlsx_response
from app.security import get_current_user
from app.services.activity_logger import log_activity

router = APIRouter()


def _generate_sku() -> str:
    """Generate a unique SKU when none is provided."""
    base = uuid.uuid4().hex[:8].upper()
    # Ensure no collision with existing SKUs
    existing = query("SELECT id FROM consumables WHERE sku = %s", [base])
    while existing:
        base = uuid.uuid4().hex[:8].upper()
        existing = query("SELECT id FROM consumables WHERE sku = %s", [base])
    return base


def _build_filters(params, category, search):
    clauses = ""
    if category:
        params.append(category)
        clauses += f" AND cat.name = %s"
    if search:
        params.append(f"%{search}%")
        clauses += f" AND c.name ILIKE %s"
    return clauses


@router.get("/categories")
def get_categories(user=Depends(get_current_user)):
    try:
        return query("SELECT * FROM categories ORDER BY name")
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/dashboard")
def get_dashboard_stats(user=Depends(get_current_user)):
    role = user.get("role")
    facility_name = user.get("facility_name")
    is_staff = role == "staff" and facility_name
    try:
        if is_staff:
            user_name = user.get("name")
            stats = query(
                """
                SELECT
                  COUNT(*) as total,
                  COUNT(*) FILTER (WHERE COALESCE(rs.user_stock, 0) >= 10) as ok,
                  COUNT(*) FILTER (WHERE COALESCE(rs.user_stock, 0) > 0 AND COALESCE(rs.user_stock, 0) < 10) as low,
                  COUNT(*) FILTER (WHERE COALESCE(rs.user_stock, 0) = 0) as out
                FROM consumables c
                LEFT JOIN (
                  SELECT consumable_id, SUM(quantity) as user_stock
                  FROM receive_logs
                  WHERE received_by = %s
                  GROUP BY consumable_id
                ) rs ON rs.consumable_id = c.id
                WHERE COALESCE(rs.user_stock, 0) > 0
                """,
                [user_name],
            )[0]
            return {
                "total": int(stats["total"]),
                "low": int(stats["low"]),
                "out": int(stats["out"]),
                "ok": int(stats["ok"]),
                "dispatched_today": 0,
                "total_dispatched": 0,
                "total_received": 0,
                "recent_dispatches": [],
            }

        total = query("SELECT COUNT(*) FROM consumables")[0]["count"]
        low = query("SELECT COUNT(*) FROM consumables WHERE stock > 0 AND stock < 10")[0]["count"]
        out = query("SELECT COUNT(*) FROM consumables WHERE stock = 0")[0]["count"]
        today = query(
            "SELECT COALESCE(SUM(quantity),0) as total FROM dispatch_logs WHERE dispatched_at::date = CURRENT_DATE"
        )[0]["total"]
        all_disp = query("SELECT COALESCE(SUM(quantity),0) as total FROM dispatch_logs")[0]["total"]
        all_recv = query("SELECT COALESCE(SUM(quantity),0) as total FROM receive_logs")[0]["total"]
        recent_disp = query(
            """
            SELECT dl.*, c.name as consumable_name, cat.name as category_name
            FROM dispatch_logs dl
            JOIN consumables c ON dl.consumable_id = c.id
            JOIN categories cat ON c.category_id = cat.id
            ORDER BY dl.dispatched_at DESC LIMIT 5
            """
        )
        return {
            "total": int(total),
            "low": int(low),
            "out": int(out),
            "ok": int(total) - int(low) - int(out),
            "dispatched_today": int(today),
            "total_dispatched": int(all_disp),
            "total_received": int(all_recv),
            "recent_dispatches": recent_disp,
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/export")
def export_inventory(user=Depends(get_current_user)):
    try:
        rows = query(
            """SELECT c.id, c.name, cat.name as category, c.unit, c.stock, c.reorder_quantity, c.price, c.description
               FROM consumables c LEFT JOIN categories cat ON c.category_id = cat.id ORDER BY cat.name, c.name"""
        )
        columns = [
            ("ID", "id", 8),
            ("Name", "name", 30),
            ("Category", "category", 18),
            ("Unit", "unit", 12),
            ("Stock", "stock", 10),
            ("Reorder Qty", "reorder_quantity", 12),
            ("Price", "price", 12),
            ("Description", "description", 30),
        ]
        return xlsx_response("inventory.xlsx", "Inventory", columns, rows)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.post("/import")
async def import_csv(user=Depends(get_current_user), file: UploadFile = File(...)):
    if not (file.content_type == "text/csv" or file.filename.endswith(".csv")):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")

    contents = await file.read()
    text = contents.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    results = list(reader)

    created = 0
    updated = 0
    errors = 0
    for row in results:
        try:
            if not row.get("name") or not row.get("unit"):
                errors += 1
                continue
            cat_res = query("SELECT id FROM categories WHERE name = %s", [row.get("category") or "General"])
            if cat_res:
                cat_id = cat_res[0]["id"]
            else:
                new_cat = query(
                    "INSERT INTO categories (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
                    [row.get("category") or "General"],
                )
                cat_id = new_cat[0]["id"]
            stock = int(float(row.get("stock") or 0))
            existing = query("SELECT id FROM consumables WHERE name = %s", [row["name"]])
            if existing:
                query(
                    "UPDATE consumables SET category_id=%s, unit=%s, stock=%s, reorder_quantity=%s, price=%s WHERE id=%s",
                    [
                        cat_id,
                        row["unit"],
                        stock,
                        int(float(row.get("reorder_quantity") or 0)),
                        float(row.get("price") or 0),
                        existing[0]["id"],
                    ],
                )
                updated += 1
            else:
                query(
                    "INSERT INTO consumables (name, category_id, unit, stock, reorder_quantity, price) VALUES (%s,%s,%s,%s,%s,%s)",
                    [
                        row["name"],
                        cat_id,
                        row["unit"],
                        stock,
                        int(float(row.get("reorder_quantity") or 0)),
                        float(row.get("price") or 0),
                    ],
                )
                created += 1
        except Exception:
            errors += 1

    return {"total_rows": len(results), "created_or_updated": created + updated, "errors": errors}


@router.get("")
def get_all(
    category: str = None,
    search: str = None,
    status: str = None,
    history_date: str = None,
    all: str = None,
    user=Depends(get_current_user),
):
    role = user.get("role")
    facility_name = user.get("facility_name")
    is_staff = role == "staff" and facility_name

    try:
        if all == "true":
            params = []
            q = """
                SELECT c.id, c.name, c.category_id, cat.name as category_name, c.unit, c.description,
                       c.stock, c.reorder_quantity, c.price, c.sku, c.min_stock, c.max_stock, c.safety_stock,
                       c.emergency_order_point, c.monthly_consumption, c.avg_consumption, c.daily_usage, c.mos
                 FROM consumables c
                 LEFT JOIN categories cat ON c.category_id = cat.id
                 WHERE 1=1
            """
            q += _build_filters(params, category, search)
            q += " ORDER BY cat.name, c.name"
            return query(q, params)

        if is_staff:
            user_name = user.get("name")
            params = [user_name]
            if history_date:
                params.append(history_date)
                q = """
                    SELECT c.id, c.name, c.category_id, cat.name as category_name, c.unit, c.description,
                           COALESCE(rs.user_stock, 0) as stock,
                           c.reorder_quantity, c.price, c.sku, c.min_stock, c.max_stock, c.safety_stock,
                           c.emergency_order_point, c.monthly_consumption, c.avg_consumption, c.daily_usage, c.mos
                    FROM consumables c
                    LEFT JOIN categories cat ON c.category_id = cat.id
                    LEFT JOIN (
                      SELECT consumable_id, SUM(quantity) as user_stock
                      FROM receive_logs
                      WHERE received_by = %s AND received_at <= %s::timestamp
                      GROUP BY consumable_id
                    ) rs ON rs.consumable_id = c.id
                    WHERE COALESCE(rs.user_stock, 0) > 0
                """
            else:
                q = """
                    SELECT c.id, c.name, c.category_id, cat.name as category_name, c.unit, c.description,
                           COALESCE(rs.user_stock, 0) as stock,
                           c.reorder_quantity, c.price, c.sku, c.min_stock, c.max_stock, c.safety_stock,
                           c.emergency_order_point, c.monthly_consumption, c.avg_consumption, c.daily_usage, c.mos
                    FROM consumables c
                    LEFT JOIN categories cat ON c.category_id = cat.id
                    LEFT JOIN (
                      SELECT consumable_id, SUM(quantity) as user_stock
                      FROM receive_logs
                      WHERE received_by = %s
                      GROUP BY consumable_id
                    ) rs ON rs.consumable_id = c.id
                    WHERE COALESCE(rs.user_stock, 0) > 0
                """
            q += _build_filters(params, category, search)
            q += " ORDER BY cat.name, c.name"
            return query(q, params)

        # Admin: central warehouse stock
        params = []
        if history_date:
            params.append(history_date)
            select_stock = """
                SELECT c.*, cat.name as category_name,
                       GREATEST(0, c.stock
                         + COALESCE(d.disp_after, 0)
                         - COALESCE(r.recv_after, 0)) as stock
                FROM consumables c
                LEFT JOIN categories cat ON c.category_id = cat.id
                LEFT JOIN (
                  SELECT consumable_id, SUM(quantity) as disp_after
                  FROM dispatch_logs
                  WHERE dispatched_at > %s::timestamp
                  GROUP BY consumable_id
                ) d ON d.consumable_id = c.id
                LEFT JOIN (
                  SELECT consumable_id, SUM(quantity) as recv_after
                  FROM receive_logs
                  WHERE received_at > %s::timestamp
                  GROUP BY consumable_id
                ) r ON r.consumable_id = c.id
            """
            params.append(history_date)
        else:
            select_stock = """
                SELECT c.*, cat.name as category_name
                FROM consumables c
                LEFT JOIN categories cat ON c.category_id = cat.id
            """
        q = select_stock + " WHERE 1=1"
        q += _build_filters(params, category, search)
        stock_expr = "GREATEST(0, c.stock" + (
            " + COALESCE(d.disp_after, 0) - COALESCE(r.recv_after, 0)" if history_date else ""
        ) + ")"
        if status == "out":
            q += f" AND {stock_expr} = 0"
        if status == "emergency":
            q += f" AND {stock_expr} > 0 AND c.emergency_order_point > 0 AND {stock_expr} <= c.emergency_order_point"
        if status == "safety":
            q += (
                f" AND {stock_expr} > 0 AND c.safety_stock > 0 AND {stock_expr} <= c.safety_stock "
                f"AND (c.emergency_order_point IS NULL OR c.emergency_order_point <= 0 OR {stock_expr} > c.emergency_order_point)"
            )
        if status == "low":
            q += (
                f" AND {stock_expr} > 0 AND COALESCE(c.min_stock, 0) > 0 AND {stock_expr} < c.min_stock "
                f"AND (c.safety_stock IS NULL OR c.safety_stock <= 0 OR {stock_expr} > c.safety_stock)"
            )
        if status == "ok":
            q += (
                f" AND {stock_expr} > 0 AND (c.min_stock IS NULL OR c.min_stock <= 0 OR {stock_expr} >= c.min_stock) "
                f"AND (c.safety_stock IS NULL OR c.safety_stock <= 0 OR {stock_expr} > c.safety_stock) "
                f"AND (c.emergency_order_point IS NULL OR c.emergency_order_point <= 0 OR {stock_expr} > c.emergency_order_point)"
            )
        q += " ORDER BY cat.name, c.name"
        return query(q, params)
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/{id}")
def get_one(id: int, user=Depends(get_current_user)):
    role = user.get("role")
    facility_name = user.get("facility_name")
    is_staff = role == "staff" and facility_name

    try:
        if is_staff:
            rows = query(
                """SELECT c.id, c.name, c.category_id, cat.name as category_name, c.unit, c.description,
                          COALESCE(fs.facility_stock, 0) as stock,
                          c.reorder_quantity, c.price, c.sku, c.min_stock, c.max_stock, c.safety_stock,
                          c.emergency_order_point, c.monthly_consumption, c.avg_consumption, c.daily_usage, c.mos
                   FROM consumables c
                   LEFT JOIN categories cat ON c.category_id = cat.id
                   LEFT JOIN (
                     SELECT consumable_id, SUM(quantity) as facility_stock
                     FROM dispatch_logs
                     WHERE destination = %s
                     GROUP BY consumable_id
                   ) fs ON fs.consumable_id = c.id
                   WHERE c.id = %s""",
                [facility_name, id],
            )
            if not rows:
                raise HTTPException(status_code=404, detail="Not found")
            return rows[0]

        rows = query(
            "SELECT c.*, cat.name as category_name FROM consumables c LEFT JOIN categories cat ON c.category_id=cat.id WHERE c.id=%s",
            [id],
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.post("", status_code=201)
def create(body: dict, user=Depends(get_current_user)):
    name = body.get("name")
    category_id = body.get("category_id")
    unit = body.get("unit")
    performed_by = user.get("name") if user else "System"
    if not name or not category_id or not unit:
        raise HTTPException(status_code=400, detail="name, category_id, unit required")

    st = int(body.get("stock") or 0)
    rq = int(body.get("reorder_quantity") or 0)
    if st > 0 and rq > 0 and rq >= st:
        raise HTTPException(status_code=400, detail="Reorder quantity must be less than current stock")

    try:
        rows = query(
            """INSERT INTO consumables (name,category_id,unit,stock,reorder_quantity,price,description,batch_no,expiry_date,sku,min_stock,max_stock,safety_stock,emergency_order_point,monthly_consumption,avg_consumption,daily_usage,mos)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            [
                name,
                category_id,
                unit,
                st,
                rq,
                body.get("price") or 0,
                body.get("description") or "",
                body.get("batch_no") or "",
                body.get("expiry_date") or None,
                body.get("sku") or _generate_sku(),
                body.get("min_stock") or 0,
                body.get("max_stock") or 0,
                body.get("safety_stock") or 0,
                body.get("emergency_order_point") or 0,
                body.get("monthly_consumption") or 0,
                body.get("avg_consumption") or 0,
                body.get("daily_usage") or 0,
                body.get("mos") or 0,
            ],
        )
        created = rows[0]

        log_activity(
            "consumable",
            created["id"],
            "created",
            performed_by,
            details=f"Consumable '{name}' added with initial stock of {st} {unit}",
            changes={
                "name": name,
                "category_id": category_id,
                "unit": unit,
                "initial_stock": st,
                "reorder_quantity": rq,
                "price": body.get("price") or 0,
            },
        )

        return created
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/{id}")
def update(id: int, body: dict, user=Depends(get_current_user)):
    performed_by = user.get("name") if user else "System"
    try:
        cur = query("SELECT * FROM consumables WHERE id=%s", [id])
        if not cur:
            raise HTTPException(status_code=404, detail="Not found")
        old_data = cur[0]
        current_stock = old_data["stock"]

        rq_raw = body.get("reorder_quantity")
        rq = int(rq_raw) if rq_raw is not None else None
        if current_stock > 0 and rq is not None and rq >= current_stock:
            raise HTTPException(status_code=400, detail="Reorder quantity must be less than current stock")

        rows = query(
            """UPDATE consumables SET name=COALESCE(%s,name), category_id=COALESCE(%s,category_id),
               unit=COALESCE(%s,unit), reorder_quantity=COALESCE(%s,reorder_quantity), price=COALESCE(%s,price),
               description=COALESCE(%s,description), batch_no=COALESCE(%s,batch_no), expiry_date=COALESCE(%s,expiry_date),
               sku=COALESCE(%s,sku), min_stock=COALESCE(%s,min_stock), max_stock=COALESCE(%s,max_stock),
               safety_stock=COALESCE(%s,safety_stock), emergency_order_point=COALESCE(%s,emergency_order_point),
               monthly_consumption=COALESCE(%s,monthly_consumption), avg_consumption=COALESCE(%s,avg_consumption),
               daily_usage=COALESCE(%s,daily_usage), mos=COALESCE(%s,mos), updated_at=NOW()
               WHERE id=%s RETURNING *""",
            [
                body.get("name"),
                body.get("category_id"),
                body.get("unit"),
                rq,
                body.get("price"),
                body.get("description"),
                body.get("batch_no"),
                body.get("expiry_date"),
                body.get("sku"),
                body.get("min_stock"),
                body.get("max_stock"),
                body.get("safety_stock"),
                body.get("emergency_order_point"),
                body.get("monthly_consumption"),
                body.get("avg_consumption"),
                body.get("daily_usage"),
                body.get("mos"),
                id,
            ],
        )
        updated = rows[0]

        log_activity(
            "consumable",
            id,
            "updated",
            performed_by,
            details=f"Consumable '{updated['name']}' updated",
            changes={
                "before": {
                    "name": old_data["name"],
                    "category_id": old_data["category_id"],
                    "unit": old_data["unit"],
                    "price": float(old_data["price"]) if old_data["price"] is not None else None,
                    "reorder_quantity": old_data["reorder_quantity"],
                },
                "after": {
                    "name": updated["name"],
                    "category_id": updated["category_id"],
                    "unit": updated["unit"],
                    "price": float(updated["price"]) if updated["price"] is not None else None,
                    "reorder_quantity": updated["reorder_quantity"],
                },
            },
        )

        return updated
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.delete("/{id}")
def delete(id: int, user=Depends(get_current_user)):
    performed_by = user.get("name") if user else "System"
    try:
        existing = query("SELECT name, unit FROM consumables WHERE id=%s", [id])
        cons_name = existing[0]["name"] if existing else "Unknown"
        query("DELETE FROM consumables WHERE id=%s", [id])

        log_activity("consumable", id, "deleted", performed_by, details=f"Consumable '{cons_name}' deleted", changes={})

        return {"message": "Deleted"}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
