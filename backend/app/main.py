from __future__ import annotations

from datetime import date, time

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .elexon_client import load_cache, refresh_january
from .metrics import analyze_day, analyze_month

app = FastAPI(title="Northstar Wind Desk", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _gate(value: str) -> time:
    try:
        hour, minute = (int(part) for part in value.split(":"))
        return time(hour, minute)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="gate must use HH:MM UTC")


@app.get("/api/day/{target_date}")
def get_day(
    target_date: date,
    gate: str = Query(default="11:00", description="Decision gate in UTC, HH:MM"),
) -> dict:
    if not (date(2026, 1, 1) <= target_date <= date(2026, 1, 31)):
        raise HTTPException(status_code=422, detail="target_date must be in January 2026")
    data = load_cache()
    if not data["actuals"] and not data["forecasts"]:
        return {
            "targetDate": target_date.isoformat(),
            "cutoffUtc": None,
            "periodCount": 0,
            "pairedCount": 0,
            "actualTotalMwh": None,
            "maeMw": None,
            "rmseMw": None,
            "wapePct": None,
            "biasMw": None,
            "peakErrorMw": None,
            "points": [],
            "dataAvailable": False,
        }
    result = analyze_day(target_date, data["actuals"], data["forecasts"], _gate(gate))
    result["dataAvailable"] = True
    return result


@app.post("/api/refresh")
async def refresh() -> dict[str, object]:
    try:
        counts = await refresh_january()
        return {"status": "refreshed", **counts}
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Elexon refresh failed: {exc}") from exc


@app.get("/api/summary")
def summary() -> dict[str, object]:
    data = load_cache()
    return {
        "actualRows": len(data["actuals"]),
        "forecastRows": len(data["forecasts"]),
        "dataAvailable": bool(data["actuals"] or data["forecasts"]),
        "source": "Elexon Insights API",
    }


@app.get("/api/monthly-summary")
def monthly_summary(
    gate: str = Query(default="11:00", description="Decision gate in UTC, HH:MM"),
) -> dict:
    data = load_cache()
    result = analyze_month(data["actuals"], data["forecasts"], _gate(gate))
    return result
