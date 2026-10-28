from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any


def parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def number(value: Any) -> float | None:
    try:
        result = float(value)
        return result if result == result and abs(result) != float("inf") else None
    except (TypeError, ValueError):
        return None


def cutoff_for(target_date: date, gate: time = time(11, 0)) -> datetime:
    return datetime.combine(target_date - timedelta(days=1), gate, tzinfo=timezone.utc)


def normalize_actual(record: dict[str, Any]) -> dict[str, Any] | None:
    start = parse_datetime(record.get("startTime"))
    generation = number(record.get("generation"))
    if start is None or generation is None:
        return None
    return {"startTime": start, "actual": generation}


def normalize_forecast(record: dict[str, Any]) -> dict[str, Any] | None:
    start = parse_datetime(record.get("startTime"))
    published = parse_datetime(record.get("publishTime"))
    generation = number(record.get("generation"))
    if start is None or published is None or generation is None:
        return None
    return {"startTime": start, "publishTime": published, "forecast": generation}


def analyze_day(
    target_date: date,
    actual_records: list[dict[str, Any]],
    forecast_records: list[dict[str, Any]],
    gate: time = time(11, 0),
) -> dict[str, Any]:
    cutoff = cutoff_for(target_date, gate)
    day_start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    actuals: dict[datetime, float] = {}
    for raw in actual_records:
        row = normalize_actual(raw)
        if row and day_start <= row["startTime"] < day_end:
            actuals[row["startTime"]] = row["actual"]

    latest: dict[datetime, dict[str, Any]] = {}
    for raw in forecast_records:
        row = normalize_forecast(raw)
        if not row or not (day_start <= row["startTime"] < day_end):
            continue
        if row["publishTime"] > cutoff:
            continue
        previous = latest.get(row["startTime"])
        if previous is None or row["publishTime"] > previous["publishTime"]:
            latest[row["startTime"]] = row

    points = []
    for start in sorted(actuals.keys() | latest.keys()):
        forecast_row = latest.get(start)
        actual = actuals.get(start)
        forecast = forecast_row["forecast"] if forecast_row else None
        delta = forecast - actual if forecast is not None and actual is not None else None
        points.append({
            "startTime": start.isoformat().replace("+00:00", "Z"),
            "actualMw": actual,
            "forecastMw": forecast,
            "errorMw": delta,
            "publishTime": forecast_row["publishTime"].isoformat().replace("+00:00", "Z") if forecast_row else None,
        })

    paired = [p for p in points if p["actualMw"] is not None and p["forecastMw"] is not None]
    count = len(paired)
    absolute_error = sum(abs(p["errorMw"]) for p in paired)
    mean_error = sum(p["errorMw"] for p in paired) / count if count else None
    actual_total_mwh = sum(p["actualMw"] * 0.5 for p in points if p["actualMw"] is not None)
    peak = max((abs(p["errorMw"]) for p in paired), default=None)
    return {
        "targetDate": target_date.isoformat(),
        "cutoffUtc": cutoff.isoformat().replace("+00:00", "Z"),
        "periodCount": len(points),
        "pairedCount": count,
        "actualTotalMwh": round(actual_total_mwh, 1),
        "maeMw": round(absolute_error / count, 2) if count else None,
        "rmseMw": round((sum(p["errorMw"] ** 2 for p in paired) / count) ** 0.5, 2) if count else None,
        "wapePct": round(absolute_error / sum(p["actualMw"] for p in paired) * 100, 2) if count and sum(p["actualMw"] for p in paired) else None,
        "biasMw": round(mean_error, 2) if mean_error is not None else None,
        "peakErrorMw": round(peak, 2) if peak is not None else None,
        "points": points,
    }


def analyze_month(
    actual_records: list[dict[str, Any]],
    forecast_records: list[dict[str, Any]],
    gate: time = time(11, 0),
) -> dict[str, Any]:
    expected_periods = 31 * 48
    daily = []
    all_pairs: list[dict[str, float]] = []
    total_actual_mwh = 0.0
    actual_periods = 0
    forecast_periods = 0

    for day_number in range(1, 32):
        target = date(2026, 1, day_number)
        result = analyze_day(target, actual_records, forecast_records, gate)
        actual_count = sum(p["actualMw"] is not None for p in result["points"])
        forecast_count = sum(p["forecastMw"] is not None for p in result["points"])
        paired = [
            {"actualMw": p["actualMw"], "errorMw": p["errorMw"]}
            for p in result["points"]
            if p["actualMw"] is not None and p["forecastMw"] is not None
        ]
        paired_count = len(paired)
        all_pairs.extend(paired)
        actual_periods += actual_count
        forecast_periods += forecast_count
        total_actual_mwh += result["actualTotalMwh"] or 0.0
        daily.append({
            "date": target.isoformat(),
            "day": day_number,
            "actualPeriods": actual_count,
            "forecastPeriods": forecast_count,
            "pairedPeriods": paired_count,
            "missingForecastPeriods": max(0, actual_count - paired_count),
            "missingActualPeriods": max(0, 48 - actual_count),
            "maeMw": result["maeMw"],
            "rmseMw": result["rmseMw"],
            "wapePct": result["wapePct"],
            "biasMw": result["biasMw"],
            "actualTotalMwh": result["actualTotalMwh"],
        })

    count = len(all_pairs)
    absolute_error = sum(abs(row["errorMw"]) for row in all_pairs)
    actual_sum = sum(row["actualMw"] for row in all_pairs)
    return {
        "period": "January 2026",
        "cutoffUtc": cutoff_for(date(2026, 1, 1), gate).strftime("%H:%M UTC (D-1)"),
        "dataAvailable": actual_periods > 0 or forecast_periods > 0,
        "expectedPeriods": expected_periods,
        "actualPeriods": actual_periods,
        "forecastPeriods": forecast_periods,
        "evaluatedPeriods": count,
        "missingForecastPeriods": max(0, actual_periods - count),
        "missingActualPeriods": max(0, expected_periods - actual_periods),
        "coveragePct": round(count / expected_periods * 100, 1),
        "actualTotalMwh": round(total_actual_mwh, 1),
        "overallMetrics": {
            "maeMw": round(absolute_error / count, 2) if count else None,
            "rmseMw": round((sum(row["errorMw"] ** 2 for row in all_pairs) / count) ** 0.5, 2) if count else None,
            "wapePct": round(absolute_error / actual_sum * 100, 2) if count and actual_sum else None,
            "biasMw": round(sum(row["errorMw"] for row in all_pairs) / count, 2) if count else None,
        },
        "dailyBreakdown": daily,
    }
