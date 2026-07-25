import calendar
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import query, transaction
from app.excel_utils import xlsx_response
from app.security import get_current_user
from app.services.activity_logger import log_activity

router = APIRouter()


# ───────────────────────── Dispatch ─────────────────────────

@router.post("/dispatch", status_code=201)
def dispatch(body: dict, user=Depends(get_current_user)):
    consumable_id = body.get("consumable_id")
    quantity = body.get("quantity")
    destination = body.get("destination")
    dispatched_by = body.get("dispatched_by")
    notes = body.get("notes")
    issued_quantity = body.get("issued_quantity")
    returned_quantity = body.get("returned_quantity")
    receiving_officer = body.get("receiving_officer")
    performed_by = user["name"] if user else dispatched_by

    if not consumable_id or not quantity or not destination or not dispatched_by:
        raise HTTPException(status_code=400, detail="consumable_id, quantity, destination, dispatched_by required")

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

            iss_qty = int(issued_quantity) if issued_quantity else quantity
            ret_qty = int(returned_quantity) if returned_quantity else 0

            cur.execute(
                """INSERT INTO dispatch_logs (consumable_id,quantity,destination,dispatched_by,notes,issued_quantity,returned_quantity,receiving_officer)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                [consumable_id, quantity, destination, dispatched_by, notes or "", iss_qty, ret_qty, receiving_officer or ""],
            )
            log_row = cur.fetchall()[0]

        log_activity(
            "dispatch",
            log_row["id"],
            "dispatched",
            performed_by,
            details=(
                f"{consumable_name} ({quantity} units, issued: {iss_qty}) dispatched to {destination}"
                + (f" received by {receiving_officer}" if receiving_officer else "")
            ),
            changes={
                "consumable_id": consumable_id,
                "consumable_name": consumable_name,
                "quantity": quantity,
                "issued_quantity": iss_qty,
                "returned_quantity": ret_qty,
                "destination": destination,
                "previous_stock": prev_stock,
                "new_stock": prev_stock - quantity,
                "notes": notes or "",
                "receiving_officer": receiving_officer or "",
            },
        )

        return {"log": log_row, "new_stock": prev_stock - quantity}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/dispatch")
def get_dispatch_logs(
    from_: str = Query(default=None, alias="from"),
    to: str = None,
    consumable_id: int = None,
    destination: str = None,
    user=Depends(get_current_user),
):
    q = """
        SELECT dl.*, c.name as consumable_name, cat.name as category_name
        FROM dispatch_logs dl
        JOIN consumables c ON dl.consumable_id = c.id
        JOIN categories cat ON c.category_id = cat.id
        WHERE 1=1
    """
    params = []
    if from_:
        params.append(from_)
        q += " AND dl.dispatched_at >= %s"
    if to:
        params.append(to)
        q += " AND dl.dispatched_at <= %s"
    if consumable_id:
        params.append(consumable_id)
        q += " AND dl.consumable_id = %s"
    if destination:
        params.append(f"%{destination}%")
        q += " AND dl.destination ILIKE %s"
    q += " ORDER BY dl.dispatched_at DESC"
    try:
        return query(q, params)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/dispatch/export")
def export_dispatch_excel(
    from_: str = Query(default=None, alias="from"),
    to: str = None,
    destination: str = None,
    user=Depends(get_current_user),
):
    q = """
        SELECT dl.id, dl.dispatched_at, c.name as consumable_name, cat.name as category_name,
               dl.quantity, dl.destination, dl.dispatched_by, dl.issued_quantity, dl.returned_quantity, dl.receiving_officer, dl.notes
        FROM dispatch_logs dl
        JOIN consumables c ON dl.consumable_id = c.id
        JOIN categories cat ON c.category_id = cat.id
        WHERE 1=1
    """
    params = []
    if from_:
        params.append(from_)
        q += " AND dl.dispatched_at >= %s"
    if to:
        params.append(to)
        q += " AND dl.dispatched_at <= %s"
    if destination:
        params.append(f"%{destination}%")
        q += " AND dl.destination ILIKE %s"
    q += " ORDER BY dl.dispatched_at DESC"

    try:
        rows = query(q, params)
        for r in rows:
            r["dispatched_at"] = r["dispatched_at"].strftime("%Y-%m-%d %H:%M:%S") if r["dispatched_at"] else ""
        columns = [
            ("ID", "id", 10),
            ("Dispatched At", "dispatched_at", 22),
            ("Consumable", "consumable_name", 28),
            ("Category", "category_name", 20),
            ("Quantity", "quantity", 12),
            ("Destination", "destination", 24),
            ("Dispatched By", "dispatched_by", 18),
            ("Issued Qty", "issued_quantity", 14),
            ("Returned Qty", "returned_quantity", 14),
            ("Receiving Officer", "receiving_officer", 20),
            ("Notes", "notes", 30),
        ]
        return xlsx_response("dispatch-logs.xlsx", "Dispatch Logs", columns, rows)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


# ───────────────────────── Receive ─────────────────────────

@router.post("/receive", status_code=201)
def receive(body: dict, user=Depends(get_current_user)):
    consumable_id = body.get("consumable_id")
    quantity = body.get("quantity")
    supplier = body.get("supplier")
    received_by = body.get("received_by")
    invoice_ref = body.get("invoice_ref")
    batch_no = body.get("batch_no")
    expiry_date = body.get("expiry_date")
    ordered_by = body.get("ordered_by")
    approved_by = body.get("approved_by")
    grn = body.get("grn")
    damaged_quantity = body.get("damaged_quantity")
    returned_quantity = body.get("returned_quantity")
    performed_by = user["name"] if user else received_by

    if not consumable_id or not quantity or not received_by:
        raise HTTPException(status_code=400, detail="consumable_id, quantity, received_by required")

    facility_name = (user.get("facility_name") or "") if user else ""

    try:
        with transaction() as cur:
            cur.execute("SELECT * FROM consumables WHERE id=%s FOR UPDATE", [consumable_id])
            rows = cur.fetchall()
            if not rows:
                raise HTTPException(status_code=404, detail="Consumable not found")

            prev_stock = rows[0]["stock"]
            consumable_name = rows[0]["name"]
            net_qty = max(0, int(quantity) - (int(damaged_quantity) if damaged_quantity else 0) - (int(returned_quantity) if returned_quantity else 0))

            cur.execute("UPDATE consumables SET stock=stock+%s, updated_at=NOW() WHERE id=%s", [net_qty, consumable_id])

            cur.execute(
                """INSERT INTO receive_logs (consumable_id,quantity,supplier,received_by,invoice_ref,facility_name,batch_no,expiry_date,ordered_by,approved_by,grn,damaged_quantity,returned_quantity)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                [
                    consumable_id,
                    quantity,
                    supplier or "",
                    received_by,
                    invoice_ref or "",
                    facility_name,
                    batch_no or "",
                    expiry_date or None,
                    ordered_by or "",
                    approved_by or "",
                    grn or "",
                    int(damaged_quantity) if damaged_quantity else 0,
                    int(returned_quantity) if returned_quantity else 0,
                ],
            )
            log_row = cur.fetchall()[0]

        log_activity(
            "receive",
            log_row["id"],
            "received",
            performed_by,
            details=(
                f"{consumable_name} ({quantity} units, net {net_qty}) received"
                + (f" from {supplier}" if supplier else "")
                + (f" at {facility_name}" if facility_name else "")
                + (f" GRN: {grn}" if grn else "")
            ),
            changes={
                "consumable_id": consumable_id,
                "consumable_name": consumable_name,
                "quantity": quantity,
                "net_quantity": net_qty,
                "supplier": supplier or "",
                "previous_stock": prev_stock,
                "new_stock": prev_stock + net_qty,
                "invoice_ref": invoice_ref or "",
                "batch_no": batch_no or "",
                "facility_name": facility_name,
                "grn": grn or "",
                "ordered_by": ordered_by or "",
                "approved_by": approved_by or "",
                "damaged_quantity": int(damaged_quantity) if damaged_quantity else 0,
                "returned_quantity": int(returned_quantity) if returned_quantity else 0,
            },
        )

        return {"log": log_row, "new_stock": prev_stock + net_qty}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/receive")
def get_receive_logs(
    from_: str = Query(default=None, alias="from"),
    to: str = None,
    user=Depends(get_current_user),
):
    role = user.get("role")
    name = user.get("name")
    is_staff = role == "staff"
    q = """
        SELECT rl.*, c.name as consumable_name, cat.name as category_name
        FROM receive_logs rl
        JOIN consumables c ON rl.consumable_id = c.id
        JOIN categories cat ON c.category_id = cat.id
        WHERE 1=1
    """
    params = []
    if is_staff:
        params.append(name)
        q += " AND rl.received_by = %s"
    if from_:
        params.append(from_)
        q += " AND rl.received_at >= %s"
    if to:
        params.append(to)
        q += " AND rl.received_at <= %s"
    q += " ORDER BY rl.received_at DESC"
    try:
        return query(q, params)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/receive/export")
def export_receive_excel(
    from_: str = Query(default=None, alias="from"),
    to: str = None,
    user=Depends(get_current_user),
):
    q = """
        SELECT rl.id, rl.received_at, c.name as consumable_name, cat.name as category_name,
               rl.quantity, rl.supplier, rl.received_by, rl.batch_no, rl.expiry_date,
               rl.invoice_ref, rl.damaged_quantity, rl.returned_quantity, rl.grn,
               rl.ordered_by, rl.approved_by, rl.facility_name
        FROM receive_logs rl
        JOIN consumables c ON rl.consumable_id = c.id
        JOIN categories cat ON c.category_id = cat.id
        WHERE 1=1
    """
    params = []
    if from_:
        params.append(from_)
        q += " AND rl.received_at >= %s"
    if to:
        params.append(to)
        q += " AND rl.received_at <= %s"
    q += " ORDER BY rl.received_at DESC"

    try:
        rows = query(q, params)
        for r in rows:
            r["received_at"] = r["received_at"].strftime("%Y-%m-%d %H:%M:%S") if r["received_at"] else ""
            r["expiry_date"] = r["expiry_date"].strftime("%Y-%m-%d") if r["expiry_date"] else ""
        columns = [
            ("ID", "id", 10),
            ("Received At", "received_at", 22),
            ("Consumable", "consumable_name", 28),
            ("Category", "category_name", 20),
            ("Quantity", "quantity", 12),
            ("Supplier", "supplier", 18),
            ("Received By", "received_by", 18),
            ("Batch No.", "batch_no", 16),
            ("Expiry Date", "expiry_date", 16),
            ("Invoice Ref", "invoice_ref", 18),
            ("Damaged Qty", "damaged_quantity", 14),
            ("Returned Qty", "returned_quantity", 14),
            ("GRN", "grn", 16),
            ("Ordered By", "ordered_by", 18),
            ("Approved By", "approved_by", 18),
            ("Facility", "facility_name", 20),
        ]
        return xlsx_response("receive-logs.xlsx", "Receive Logs", columns, rows)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


# ───────────────────────── Reports (period-based) ─────────────────────────

def _period_filter(period):
    """Returns (sql_fragment, params) for a dispatch_logs period filter — safe/parameterized."""
    today = date.today()
    if period == "daily":
        return "dispatched_at >= %s", [today.isoformat()]
    if period == "weekly":
        return "dispatched_at >= %s", [(today - timedelta(days=7)).isoformat()]
    if period == "monthly":
        return "dispatched_at >= %s", [today.replace(day=1).isoformat()]
    if period == "yearly":
        return "dispatched_at >= %s", [today.replace(month=1, day=1).isoformat()]
    return "1=1", []


@router.get("/reports")
def get_report(
    period: str = "monthly",
    from_: str = Query(default=None, alias="from"),
    to: str = None,
    user=Depends(get_current_user),
):
    if from_ and to:
        date_filter, filter_params = "dl.dispatched_at BETWEEN %s AND %s", [from_, to]
    else:
        frag, frag_params = _period_filter(period)
        date_filter, filter_params = f"dl.{frag}", frag_params

    try:
        summary = query(
            f"""
            SELECT
              SUM(dl.quantity) as total_dispatched,
              COUNT(dl.id) as total_events,
              COUNT(DISTINCT dl.consumable_id) as unique_items,
              COUNT(DISTINCT dl.destination) as destinations
            FROM dispatch_logs dl
            WHERE {date_filter}
            """,
            filter_params,
        )[0]

        by_item = query(
            f"""
            SELECT c.id, c.name, cat.name as category, SUM(dl.quantity) as qty, COUNT(dl.id) as events, c.stock as remaining
            FROM dispatch_logs dl
            JOIN consumables c ON dl.consumable_id = c.id
            JOIN categories cat ON c.category_id = cat.id
            WHERE {date_filter}
            GROUP BY c.id, c.name, cat.name, c.stock
            ORDER BY qty DESC
            """,
            filter_params,
        )

        by_category = query(
            f"""
            SELECT cat.name as category, SUM(dl.quantity) as qty, COUNT(dl.id) as events
            FROM dispatch_logs dl
            JOIN consumables c ON dl.consumable_id = c.id
            JOIN categories cat ON c.category_id = cat.id
            WHERE {date_filter}
            GROUP BY cat.name
            ORDER BY qty DESC
            """,
            filter_params,
        )

        by_destination = query(
            f"""
            SELECT dl.destination, SUM(dl.quantity) as qty, COUNT(dl.id) as events
            FROM dispatch_logs dl
            WHERE {date_filter}
            GROUP BY dl.destination
            ORDER BY qty DESC
            """,
            filter_params,
        )

        received = query(
            """
            SELECT COALESCE(SUM(quantity),0) as total_received, COUNT(id) as events
            FROM receive_logs
            WHERE received_at >= CURRENT_DATE - INTERVAL '30 days'
            """
        )[0]

        return {
            "summary": summary,
            "by_item": by_item,
            "by_category": by_category,
            "by_destination": by_destination,
            "received": received,
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/reports/export")
def export_report_excel(period: str = "monthly", user=Depends(get_current_user)):
    frag, frag_params = _period_filter(period)
    date_filter = f"dl.{frag}"
    try:
        rows = query(
            f"""
            SELECT dl.id, dl.dispatched_at, c.name as consumable, cat.name as category,
                   dl.quantity, dl.destination, dl.dispatched_by, dl.notes
            FROM dispatch_logs dl
            JOIN consumables c ON dl.consumable_id = c.id
            JOIN categories cat ON c.category_id = cat.id
            WHERE {date_filter}
            ORDER BY dl.dispatched_at DESC
            """,
            frag_params,
        )
        for r in rows:
            r["dispatched_at"] = r["dispatched_at"].strftime("%Y-%m-%d %H:%M:%S") if r["dispatched_at"] else ""

        columns = [
            ("ID", "id", 8),
            ("Date", "dispatched_at", 20),
            ("Consumable", "consumable", 30),
            ("Category", "category", 18),
            ("Quantity", "quantity", 12),
            ("Destination", "destination", 25),
            ("Dispatched By", "dispatched_by", 20),
            ("Notes", "notes", 30),
        ]
        return xlsx_response(f"dispatch-report-{period}.xlsx", "Dispatch Report", columns, rows)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


# ───────────────────────── Hierarchical report ─────────────────────────

def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _week_end(d: date) -> date:
    return _week_start(d) + timedelta(days=6)


def _month_end(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def _quarter_start(d: date) -> date:
    q = (d.month - 1) // 3
    return d.replace(month=q * 3 + 1, day=1)


def _quarter_end(d: date) -> date:
    q = (d.month - 1) // 3
    end_month = q * 3 + 3
    return date(d.year, end_month, calendar.monthrange(d.year, end_month)[1])


def _add_months_overflow(d: date, n: int) -> date:
    total = d.year * 12 + (d.month - 1) + n
    year = total // 12
    month0 = total % 12
    days_in_month = calendar.monthrange(year, month0 + 1)[1]
    if d.day <= days_in_month:
        return date(year, month0 + 1, d.day)
    return date(year, month0 + 1, days_in_month) + timedelta(days=d.day - days_in_month)


def _get_range(period: str, ref_date: date):
    if period == "daily":
        return ref_date, ref_date, f"Daily — {ref_date.strftime('%a %b %d %Y')}"
    if period == "weekly":
        ws, we = _week_start(ref_date), _week_end(ref_date)
        return ws, we, f"Week of {ws.isoformat()} to {we.isoformat()}"
    if period == "monthly":
        return ref_date.replace(day=1), _month_end(ref_date), f"{ref_date.strftime('%B')} {ref_date.year}"
    if period == "quarterly":
        q = (ref_date.month - 1) // 3 + 1
        return _quarter_start(ref_date), _quarter_end(ref_date), f"Q{q} {ref_date.year}"
    if period == "yearly":
        return date(ref_date.year, 1, 1), date(ref_date.year, 12, 31), f"{ref_date.year}"
    return ref_date, ref_date, f"Daily — {ref_date.strftime('%a %b %d %Y')}"


def _prev_period_ref(period: str, ref_date: date) -> date:
    if period == "daily":
        return ref_date - timedelta(days=1)
    if period == "weekly":
        return ref_date - timedelta(days=7)
    if period == "monthly":
        return _add_months_overflow(ref_date, -1)
    if period == "quarterly":
        return _add_months_overflow(ref_date, -3)
    if period == "yearly":
        return _add_months_overflow(ref_date, -12)
    return ref_date


@router.get("/reports/hierarchical")
def get_hierarchical_report(period: str = "monthly", date_: str = Query(default=None, alias="date"), user=Depends(get_current_user)):
    ref_date = datetime.fromisoformat(date_).date() if date_ else date.today()
    frm, to, label = _get_range(period, ref_date)
    frm_s, to_s = frm.isoformat(), to.isoformat()

    try:
        disp_summary = query(
            """
            SELECT
              COALESCE(SUM(quantity), 0) as total_dispatched,
              COUNT(id) as total_events,
              COUNT(DISTINCT consumable_id) as unique_items,
              COUNT(DISTINCT destination) as destinations
            FROM dispatch_logs
            WHERE dispatched_at::date >= %s AND dispatched_at::date <= %s
            """,
            [frm_s, to_s],
        )[0]

        disp_by_item = query(
            """
            SELECT c.id, c.name, cat.name as category, SUM(dl.quantity) as qty,
                   COUNT(dl.id) as events, c.stock as remaining
            FROM dispatch_logs dl
            JOIN consumables c ON dl.consumable_id = c.id
            LEFT JOIN categories cat ON c.category_id = cat.id
            WHERE dl.dispatched_at::date >= %s AND dl.dispatched_at::date <= %s
            GROUP BY c.id, c.name, cat.name, c.stock
            ORDER BY qty DESC
            """,
            [frm_s, to_s],
        )

        disp_by_category = query(
            """
            SELECT cat.name as category, SUM(dl.quantity) as qty, COUNT(dl.id) as events
            FROM dispatch_logs dl
            JOIN consumables c ON dl.consumable_id = c.id
            LEFT JOIN categories cat ON c.category_id = cat.id
            WHERE dl.dispatched_at::date >= %s AND dl.dispatched_at::date <= %s
            GROUP BY cat.name
            ORDER BY qty DESC
            """,
            [frm_s, to_s],
        )

        disp_by_destination = query(
            """
            SELECT destination, SUM(quantity) as qty, COUNT(id) as events
            FROM dispatch_logs
            WHERE dispatched_at::date >= %s AND dispatched_at::date <= %s
            GROUP BY destination
            ORDER BY qty DESC
            """,
            [frm_s, to_s],
        )

        rec_summary = query(
            """
            SELECT COALESCE(SUM(quantity), 0) as total_received, COUNT(id) as events
            FROM receive_logs
            WHERE received_at::date >= %s AND received_at::date <= %s
            """,
            [frm_s, to_s],
        )[0]

        rec_by_item = query(
            """
            SELECT c.id, c.name, cat.name as category, SUM(rl.quantity) as qty,
                   COUNT(rl.id) as events
            FROM receive_logs rl
            JOIN consumables c ON rl.consumable_id = c.id
            LEFT JOIN categories cat ON c.category_id = cat.id
            WHERE rl.received_at::date >= %s AND rl.received_at::date <= %s
            GROUP BY c.id, c.name, cat.name
            ORDER BY qty DESC
            """,
            [frm_s, to_s],
        )

        daily_breakdown = []
        if period == "weekly":
            daily_breakdown = query(
                """
                SELECT dl.dispatched_at::date as day, SUM(dl.quantity) as qty, COUNT(dl.id) as events
                FROM dispatch_logs dl
                WHERE dl.dispatched_at::date >= %s AND dl.dispatched_at::date <= %s
                GROUP BY dl.dispatched_at::date
                ORDER BY day
                """,
                [frm_s, to_s],
            )

        weekly_breakdown = []
        if period == "monthly":
            weekly_breakdown = query(
                """
                SELECT
                  date_trunc('week', dl.dispatched_at)::date as week_start,
                  SUM(dl.quantity) as qty,
                  COUNT(dl.id) as events
                FROM dispatch_logs dl
                WHERE dl.dispatched_at::date >= %s AND dl.dispatched_at::date <= %s
                GROUP BY date_trunc('week', dl.dispatched_at)::date
                ORDER BY week_start
                """,
                [frm_s, to_s],
            )

        monthly_breakdown = []
        if period in ("quarterly", "yearly"):
            monthly_breakdown = query(
                """
                SELECT
                  date_trunc('month', dl.dispatched_at)::date as month_start,
                  SUM(dl.quantity) as qty,
                  COUNT(dl.id) as events
                FROM dispatch_logs dl
                WHERE dl.dispatched_at::date >= %s AND dl.dispatched_at::date <= %s
                GROUP BY date_trunc('month', dl.dispatched_at)::date
                ORDER BY month_start
                """,
                [frm_s, to_s],
            )

        prev_frm, prev_to, _ = _get_range(period, _prev_period_ref(period, ref_date))
        prev_summary = query(
            """
            SELECT COALESCE(SUM(quantity), 0) as total_dispatched
            FROM dispatch_logs
            WHERE dispatched_at::date >= %s AND dispatched_at::date <= %s
            """,
            [prev_frm.isoformat(), prev_to.isoformat()],
        )[0]

        return {
            "period": period,
            "date": ref_date.isoformat(),
            "range": {"from": frm_s, "to": to_s, "label": label},
            "summary": {
                **disp_summary,
                "total_received": rec_summary["total_received"] or 0,
                "receive_events": rec_summary["events"] or 0,
            },
            "by_item": disp_by_item,
            "by_category": disp_by_category,
            "by_destination": disp_by_destination,
            "received_items": rec_by_item,
            "daily_breakdown": daily_breakdown,
            "weekly_breakdown": weekly_breakdown,
            "monthly_breakdown": monthly_breakdown,
            "trend": {
                "current": int(disp_summary["total_dispatched"] or 0),
                "previous": int(prev_summary["total_dispatched"] or 0),
            },
        }
    except Exception as err:
        print(f"Hierarchical report error: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/reports/calendar")
def get_calendar_data(month: str = None, user=Depends(get_current_user)):
    today = date.today()
    year = int(month.split("-")[0]) if month else today.year
    mon = int(month.split("-")[1]) if month else today.month
    frm = date(year, mon, 1)
    end_day = calendar.monthrange(year, mon)[1]
    to = date(year, mon, end_day)

    try:
        disp_rows = query(
            """
            SELECT dl.dispatched_at::date as day,
                   SUM(dl.quantity) as dispatched,
                   COUNT(dl.id) as events
            FROM dispatch_logs dl
            WHERE dl.dispatched_at::date >= %s AND dl.dispatched_at::date <= %s
            GROUP BY dl.dispatched_at::date
            ORDER BY day
            """,
            [frm.isoformat(), to.isoformat()],
        )

        rec_rows = query(
            """
            SELECT received_at::date as day,
                   SUM(quantity) as received
            FROM receive_logs
            WHERE received_at::date >= %s AND received_at::date <= %s
            GROUP BY received_at::date
            """,
            [frm.isoformat(), to.isoformat()],
        )

        day_map = {}
        for r in disp_rows:
            day_map[r["day"].isoformat()] = {"dispatched": int(r["dispatched"]), "events": int(r["events"])}
        for r in rec_rows:
            key = r["day"].isoformat()
            if key not in day_map:
                day_map[key] = {"dispatched": 0, "events": 0}
            day_map[key]["received"] = int(r["received"])

        days = []
        for d in range(1, end_day + 1):
            date_str = date(year, mon, d).isoformat()
            dow = date(year, mon, d).isoweekday() % 7  # JS getDay(): Sunday=0..Saturday=6
            entry = day_map.get(date_str, {})
            days.append(
                {
                    "date": date_str,
                    "day": d,
                    "dow": dow,
                    "dispatched": entry.get("dispatched", 0),
                    "received": entry.get("received", 0),
                    "events": entry.get("events", 0),
                    "hasData": bool(entry.get("dispatched") or entry.get("received")),
                }
            )

        return {"month": f"{year}-{mon:02d}", "days": days}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
