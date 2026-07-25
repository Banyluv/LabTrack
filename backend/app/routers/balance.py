from fastapi import APIRouter, Depends, HTTPException

from app.db import query
from app.security import get_current_user
from app.services.balance_service import check_request_eligibility, get_facility_balance

router = APIRouter()


@router.get("/check/{consumable_id}")
def check(consumable_id: int, user=Depends(get_current_user)):
    try:
        return check_request_eligibility(user["id"], consumable_id)
    except Exception as err:
        print(f"[Balance] Check eligibility error: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/facility/{facility_name}/consumable/{consumable_id}")
def facility_consumable_balance(facility_name: str, consumable_id: int, user=Depends(get_current_user)):
    try:
        return get_facility_balance(consumable_id, facility_name)
    except Exception as err:
        print(f"[Balance] Facility balance error: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/my-facility")
def my_facility(user=Depends(get_current_user)):
    try:
        user_rows = query("SELECT facility_name FROM users WHERE id = %s", [user["id"]])
        facility_name = user_rows[0]["facility_name"] if user_rows else None
        if not facility_name:
            return {"facility_name": "N/A", "balances": [], "message": "No facility assigned"}

        rows = query(
            """SELECT DISTINCT dl.consumable_id, c.name as consumable_name, c.unit, c.stock,
                      cat.name as category_name
               FROM dispatch_logs dl
               JOIN consumables c ON dl.consumable_id = c.id
               JOIN categories cat ON c.category_id = cat.id
               WHERE dl.destination = %s
               ORDER BY c.name""",
            [facility_name],
        )

        balances = []
        for row in rows:
            balance = get_facility_balance(row["consumable_id"], facility_name)
            balances.append(
                {
                    **balance,
                    "consumable_name": row["consumable_name"],
                    "unit": row["unit"],
                    "warehouse_stock": row["stock"],
                    "category_name": row["category_name"],
                }
            )

        return {"facility_name": facility_name, "balances": balances}
    except Exception as err:
        print(f"[Balance] My facility error: {err}")
        raise HTTPException(status_code=500, detail=str(err))
