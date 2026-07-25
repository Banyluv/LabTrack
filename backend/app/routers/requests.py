from fastapi import APIRouter, Depends, HTTPException

from app.db import query, transaction
from app.security import admin_only, get_current_user
from app.services.activity_logger import log_activity
from app.services.balance_service import check_request_eligibility
from app.services.email_service import send_approved_email, send_rejected_email
from app.services.notification_service import send_notification

router = APIRouter()


@router.post("", status_code=201)
def create_request(body: dict, user=Depends(get_current_user)):
    consumable_id = body.get("consumable_id")
    quantity = body.get("quantity")
    notes = body.get("notes")
    requesting_officer = body.get("requesting_officer")
    user_id = user["id"]
    requested_by = user["name"]
    performed_by = user["name"]

    if not consumable_id or not quantity:
        raise HTTPException(status_code=400, detail="Consumable ID and quantity are required")

    try:
        eligibility = check_request_eligibility(user_id, consumable_id)
        if not eligibility["allowed"]:
            raise HTTPException(
                status_code=400,
                detail={"error": eligibility["reason"], "balance": eligibility["balance"], "code": "BALANCE_NOT_SETTLED"},
            )

        cons = query("SELECT name, unit FROM consumables WHERE id=%s", [consumable_id])
        consumable_name = cons[0]["name"] if cons else "Unknown"
        unit = cons[0]["unit"] if cons else "units"

        rows = query(
            """INSERT INTO consumable_requests (consumable_id, user_id, quantity, status, requested_by, notes, requesting_officer)
               VALUES (%s, %s, %s, 'pending', %s, %s, %s)
               RETURNING *""",
            [consumable_id, user_id, quantity, requested_by, notes or "", requesting_officer or ""],
        )
        created = rows[0]

        log_activity(
            "request",
            created["id"],
            "created",
            performed_by,
            details=f"Request created for {consumable_name} ({quantity} {unit}) by {requested_by}",
            changes={"consumable": consumable_name, "quantity": quantity, "status": "pending", "notes": notes or ""},
        )

        try:
            admins = query("SELECT id FROM users WHERE LOWER(role) IN ('admin', 'super_admin')")
            for admin in admins:
                send_notification(
                    admin["id"],
                    "request_created",
                    "New Consumable Request",
                    message=f"{requested_by} requested {quantity} {unit} of {consumable_name}",
                    data={
                        "request_id": created["id"],
                        "consumable": consumable_name,
                        "quantity": quantity,
                        "unit": unit,
                        "requested_by": requested_by,
                        "performed_by": performed_by,
                    },
                    link="/dashboard/approve-requests",
                )
        except Exception as notif_err:
            print(f"[Notification] Failed to notify admins: {notif_err}")

        return {**created, "balance": eligibility["balance"]}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/my-requests")
def get_user_requests(user=Depends(get_current_user)):
    try:
        return query(
            """SELECT cr.*,
                      c.name as consumable_name,
                      c.unit,
                      c.stock as current_stock,
                      c.min_stock,
                      c.max_stock,
                      c.safety_stock,
                      c.emergency_order_point,
                      c.monthly_consumption,
                      c.avg_consumption,
                      c.sku,
                      c.category_id,
                      c.reorder_quantity
               FROM consumable_requests cr
               JOIN consumables c ON cr.consumable_id = c.id
               WHERE cr.user_id = %s
               ORDER BY cr.created_at DESC""",
            [user["id"]],
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.get("")
def get_all_requests(user=Depends(admin_only)):
    try:
        return query(
            """SELECT cr.*,
                      c.name as consumable_name,
                      c.unit,
                      c.stock as consumable_stock,
                      c.min_stock,
                      c.max_stock,
                      c.safety_stock,
                      c.emergency_order_point,
                      c.monthly_consumption,
                      c.avg_consumption,
                      c.sku,
                      c.reorder_quantity,
                      u.name as user_name,
                      u.email as user_email,
                      u.facility_name as user_facility
               FROM consumable_requests cr
               JOIN consumables c ON cr.consumable_id = c.id
               JOIN users u ON cr.user_id = u.id
               ORDER BY cr.created_at DESC"""
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/{request_id}/approve")
def approve_request(request_id: int, body: dict, user=Depends(admin_only)):
    notes = body.get("notes")
    approved_quantity = body.get("approved_quantity")
    admin_comment = body.get("admin_comment")
    approved_by = user["name"]

    try:
        with transaction() as cur:
            cur.execute(
                """SELECT cr.*, u.email as user_email, u.name as user_name, u.facility_name as user_facility
                   FROM consumable_requests cr
                   JOIN users u ON cr.user_id = u.id
                   WHERE cr.id = %s
                   FOR UPDATE OF cr""",
                [request_id],
            )
            requests_ = cur.fetchall()
            if not requests_:
                raise HTTPException(status_code=404, detail="Request not found")

            request = requests_[0]
            if request["status"] != "pending":
                raise HTTPException(status_code=400, detail=f"Request is already {request['status']}")

            qty = int(approved_quantity) if approved_quantity is not None else request["quantity"]
            if qty <= 0:
                raise HTTPException(status_code=400, detail="Approved quantity must be a positive number")

            cur.execute("SELECT stock, name, unit FROM consumables WHERE id = %s FOR UPDATE", [request["consumable_id"]])
            consumables = cur.fetchall()
            if not consumables:
                raise HTTPException(status_code=404, detail="Consumable not found")

            consumable = consumables[0]
            if consumable["stock"] < qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock. Requested: {qty}, Available: {consumable['stock']}",
                )

            cur.execute(
                "UPDATE consumables SET stock = stock - %s, updated_at = NOW() WHERE id = %s",
                [qty, request["consumable_id"]],
            )

            destination = request["user_facility"] or "Facility"
            cur.execute(
                """INSERT INTO dispatch_logs (consumable_id, quantity, destination, dispatched_by, notes)
                   VALUES (%s, %s, %s, %s, %s)""",
                [request["consumable_id"], qty, destination, approved_by, notes or ""],
            )

            final_notes = (
                (f"{request['notes']} | [Admin]: {notes}" if request["notes"] else f"[Admin]: {notes}")
                if notes
                else request["notes"]
            )

            cur.execute(
                """UPDATE consumable_requests
                   SET status = 'approved',
                       approved_by = %s,
                       approved_quantity = %s,
                       notes = %s,
                       admin_comment = %s,
                       updated_at = NOW()
                   WHERE id = %s
                   RETURNING *""",
                [approved_by, qty, final_notes, admin_comment or "", request_id],
            )
            updated = cur.fetchall()[0]

        log_activity(
            "request",
            request_id,
            "approved",
            approved_by,
            details=f"Request #{request_id} for {consumable['name']} approved: {qty} {consumable['unit']} dispatched to {destination}",
            changes={
                "consumable": consumable["name"],
                "requested_quantity": request["quantity"],
                "approved_quantity": qty,
                "previous_status": "pending",
                "new_status": "approved",
                "previous_stock": consumable["stock"],
                "new_stock": consumable["stock"] - qty,
                "destination": destination,
                "admin_comment": admin_comment or "",
            },
        )

        if request["user_email"]:
            try:
                send_approved_email(
                    request["user_email"],
                    request["user_name"] or request["requested_by"],
                    consumable["name"],
                    request["quantity"],
                    consumable["unit"],
                    qty,
                    admin_comment or "",
                    request_id,
                )
            except Exception as email_err:
                print(f"[Email] Approved email failed: {email_err}")

        try:
            send_notification(
                request["user_id"],
                "request_approved",
                "Request Approved",
                message=(
                    f"Your request for {request['quantity']} {consumable['unit']} of {consumable['name']} has been approved. "
                    f"{qty} {consumable['unit']} dispatched." + (f" Reason: {admin_comment}" if admin_comment else "")
                ),
                data={
                    "request_id": request_id,
                    "consumable": consumable["name"],
                    "quantity_requested": request["quantity"],
                    "quantity_approved": qty,
                    "unit": consumable["unit"],
                    "admin_comment": admin_comment or "",
                    "performed_by": approved_by,
                },
                link="/dashboard/requests",
            )
        except Exception as notif_err:
            print(f"[Notification] Failed to notify requester: {notif_err}")

        return updated
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@router.put("/{request_id}/reject")
def reject_request(request_id: int, body: dict, user=Depends(admin_only)):
    notes = body.get("notes")
    admin_comment = body.get("admin_comment")
    approved_by = user["name"]

    try:
        existing_rows = query(
            """SELECT cr.*, c.name as consumable_name, c.unit, u.email as user_email, u.name as user_name
               FROM consumable_requests cr
               JOIN consumables c ON cr.consumable_id = c.id
               JOIN users u ON cr.user_id = u.id
               WHERE cr.id = %s""",
            [request_id],
        )
        if not existing_rows:
            raise HTTPException(status_code=404, detail="Request not found")

        existing = existing_rows[0]
        original_notes = existing["notes"] or ""
        final_notes = (
            (f"{original_notes} | [Admin]: {notes}" if original_notes else f"[Admin]: {notes}") if notes else original_notes
        )

        rows = query(
            """UPDATE consumable_requests
               SET status = 'rejected',
                   approved_by = %s,
                   notes = %s,
                   admin_comment = %s,
                   updated_at = NOW()
               WHERE id = %s
               RETURNING *""",
            [approved_by, final_notes, admin_comment or "", request_id],
        )
        updated = rows[0]

        log_activity(
            "request",
            request_id,
            "rejected",
            approved_by,
            details=f"Request #{request_id} for {existing['consumable_name']} ({existing['quantity']} {existing['unit']}) rejected",
            changes={
                "consumable": existing["consumable_name"],
                "quantity": existing["quantity"],
                "previous_status": "pending",
                "new_status": "rejected",
                "admin_comment": admin_comment or "",
            },
        )

        if existing["user_email"]:
            try:
                send_rejected_email(
                    existing["user_email"],
                    existing["user_name"] or existing["requested_by"],
                    existing["consumable_name"],
                    existing["quantity"],
                    existing["unit"],
                    admin_comment or "",
                    request_id,
                )
            except Exception as email_err:
                print(f"[Email] Rejected email failed: {email_err}")

        try:
            send_notification(
                existing["user_id"],
                "request_rejected",
                "Request Rejected",
                message=(
                    f"Your request for {existing['quantity']} {existing['unit']} of {existing['consumable_name']} was rejected."
                    + (f" Reason: {admin_comment}" if admin_comment else "")
                ),
                data={
                    "request_id": request_id,
                    "consumable": existing["consumable_name"],
                    "quantity_requested": existing["quantity"],
                    "unit": existing["unit"],
                    "admin_comment": admin_comment or "",
                    "performed_by": approved_by,
                },
                link="/dashboard/requests",
            )
        except Exception as notif_err:
            print(f"[Notification] Failed to notify requester: {notif_err}")

        return updated
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))
