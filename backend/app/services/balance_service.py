from datetime import date, timedelta

from app.db import query


def get_facility_balance(consumable_id, facility_name):
    """For a consumable/facility pair: total dispatched, total used, remaining balance,
    daily usage rate, and a forecast date for the next distribution."""
    disp_row = query(
        """SELECT COALESCE(SUM(quantity), 0) as total_dispatched
           FROM dispatch_logs
           WHERE consumable_id = %s AND destination = %s""",
        [consumable_id, facility_name],
    )[0]
    total_dispatched = int(disp_row["total_dispatched"])

    usage_row = query(
        """SELECT COALESCE(SUM(dul.quantity), 0) as total_used
           FROM daily_usage_logs dul
           JOIN users u ON dul.used_by = u.name
           WHERE dul.consumable_id = %s AND u.facility_name = %s""",
        [consumable_id, facility_name],
    )[0]
    total_used = int(usage_row["total_used"])

    balance = total_dispatched - total_used
    is_balanced = balance <= 0

    rate_row = query(
        """SELECT
             COUNT(DISTINCT dul.usage_date) as active_days,
             COALESCE(SUM(dul.quantity), 0) as total_qty,
             MIN(dul.usage_date) as first_date,
             MAX(dul.usage_date) as last_date
           FROM daily_usage_logs dul
           JOIN users u ON dul.used_by = u.name
           WHERE dul.consumable_id = %s AND u.facility_name = %s""",
        [consumable_id, facility_name],
    )[0]

    active_days = int(rate_row["active_days"] or 0)
    total_qty = float(rate_row["total_qty"] or 0)
    first_date = rate_row["first_date"]
    last_date = rate_row["last_date"]

    daily_usage_rate = 0.0
    days_remaining = None
    forecast_date = None

    if active_days > 0 and total_qty > 0:
        daily_usage_rate = total_qty / active_days

        if daily_usage_rate > 0 and balance > 0:
            days_remaining = round(balance / daily_usage_rate)
            forecast_date = (date.today() + timedelta(days=days_remaining)).isoformat()
        elif daily_usage_rate > 0 and balance <= 0:
            days_remaining = 0
            forecast_date = date.today().isoformat()

    last_dispatch_row = query(
        """SELECT MAX(dispatched_at) as last_dispatch_date
           FROM dispatch_logs
           WHERE consumable_id = %s AND destination = %s""",
        [consumable_id, facility_name],
    )[0]
    last_dispatch_date = last_dispatch_row["last_dispatch_date"]

    return {
        "consumable_id": consumable_id,
        "facility_name": facility_name,
        "total_dispatched": total_dispatched,
        "total_used": total_used,
        "balance": balance,
        "is_balanced": is_balanced,
        "daily_usage_rate": round(daily_usage_rate * 100) / 100,
        "active_days": active_days,
        "days_remaining": days_remaining,
        "forecast_date": forecast_date,
        "last_dispatch_date": last_dispatch_date,
        "first_usage_date": first_date,
        "last_usage_date": last_date,
    }


def check_request_eligibility(user_id, consumable_id):
    """Returns {allowed, reason, balance} — mirrors the Node balance-settlement gate on new requests."""
    user_rows = query("SELECT name, facility_name FROM users WHERE id = %s", [user_id])
    if not user_rows:
        return {"allowed": False, "reason": "User not found", "balance": None}

    facility_name = user_rows[0]["facility_name"]

    if not facility_name:
        return {
            "allowed": True,
            "reason": None,
            "balance": {
                "consumable_id": consumable_id,
                "facility_name": "N/A",
                "total_dispatched": 0,
                "total_used": 0,
                "balance": 0,
                "is_balanced": True,
                "daily_usage_rate": 0,
                "active_days": 0,
                "days_remaining": None,
                "forecast_date": None,
                "last_dispatch_date": None,
                "first_usage_date": None,
                "last_usage_date": None,
            },
        }

    balance = get_facility_balance(consumable_id, facility_name)

    if not balance["is_balanced"]:
        return {
            "allowed": False,
            "reason": (
                f"Previous dispatch of {balance['total_dispatched']} units is not fully accounted for. "
                f"{balance['balance']} units remain unlogged in daily usage. "
                "Please log daily usage entries before requesting more."
            ),
            "balance": balance,
        }

    return {"allowed": True, "reason": None, "balance": balance}
