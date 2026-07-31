import os
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.db import init_pool
from app.routers import (
    activities,
    auth,
    balance,
    chat,
    consumables,
    daily_usage,
    facilities,
    notifications,
    procurement,
    quarterly_reports,
    requests as requests_router,
    stock_adjustments,
    stock_transfers,
    suppliers,
    transactions,
    units,
)

app = FastAPI()

frontend_url = os.environ.get("FRONTEND_URL")
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
allow_origins = [frontend_url] if frontend_url else ["http://localhost:3000", "http://localhost:3001"]
if allowed_origins_env:
    allow_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    content = exc.detail if isinstance(exc.detail, dict) else {"error": exc.detail}
    return JSONResponse(status_code=exc.status_code, content=jsonable_encoder(content))


@app.on_event("startup")
def on_startup():
    init_pool()


app.include_router(auth.router, prefix="/api/auth")
app.include_router(consumables.router, prefix="/api/consumables")
app.include_router(requests_router.router, prefix="/api/requests")
app.include_router(quarterly_reports.router, prefix="/api/reports/quarterly")
app.include_router(units.router, prefix="/api/units")
app.include_router(facilities.router, prefix="/api/facilities")
app.include_router(suppliers.router, prefix="/api/suppliers")
app.include_router(stock_transfers.router, prefix="/api/stock-transfers")
app.include_router(procurement.router, prefix="/api/procurement")
app.include_router(activities.router, prefix="/api/activities")
app.include_router(stock_adjustments.router, prefix="/api/stock-adjustments")
app.include_router(daily_usage.router, prefix="/api/daily-usage")
app.include_router(notifications.router, prefix="/api/notifications")
app.include_router(chat.router, prefix="/api/chat")
app.include_router(balance.router, prefix="/api/balance")
app.include_router(transactions.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}
