from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx

API_BASE = os.getenv("ELEXON_API_BASE", "https://data.elexon.co.uk/bmrs/api/v1")
DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parents[1] / "data"))
CACHE_FILE = DATA_DIR / "jan_2026_wind.json"


def _rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            if isinstance(payload.get(key), list):
                return [item for item in payload[key] if isinstance(item, dict)]
    return []


def load_cache() -> dict[str, list[dict[str, Any]]]:
    if not CACHE_FILE.exists():
        return {"actuals": [], "forecasts": []}
    try:
        with CACHE_FILE.open(encoding="utf-8") as file:
            data = json.load(file)
        return {"actuals": data.get("actuals", []), "forecasts": data.get("forecasts", [])}
    except (OSError, json.JSONDecodeError):
        return {"actuals": [], "forecasts": []}


async def fetch_json(client: httpx.AsyncClient, dataset: str, params: dict[str, str]) -> list[dict[str, Any]]:
    response = await client.get(f"{API_BASE}/datasets/{dataset}/stream", params=params)
    response.raise_for_status()
    return _rows(response.json())


async def refresh_january() -> dict[str, int]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    timeout = httpx.Timeout(45.0, connect=15.0)
    actuals: list[dict[str, Any]] = []
    forecasts: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        actuals = await fetch_json(client, "FUELHH", {
            "fuelType": "WIND",
            "settlementDateFrom": "2026-01-01",
            "settlementDateTo": "2026-01-31",
        })
        # Include Dec 31 publications: they can be eligible for Jan 1 delivery.
        forecasts = await fetch_json(client, "WINDFOR", {
            "publishDateTimeFrom": "2025-12-31T00:00:00Z",
            "publishDateTimeTo": "2026-01-31T00:00:00Z",
        })
    payload = {"source": "Elexon Insights API", "actuals": actuals, "forecasts": forecasts}
    CACHE_FILE.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    return {"actualRows": len(actuals), "forecastRows": len(forecasts)}
