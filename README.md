# Northstar Wind Desk (UK Power Day-Ahead Evaluation)

An operational decision-support desk and backtesting engine designed for UK day-ahead power trading. The platform ingests half-hourly national wind generation outturns and day-ahead forecast snapshots from the Elexon Insights BMRS API, strictly enforcing point-in-time constraints to evaluate trading risk without look-ahead bias.

---

## Live Deployments & Demo

- **Hosted Dashboard (Frontend)**: [https://grid-wind-eval.vercel.app](https://grid-wind-eval.vercel.app)
- **Backend API Docs (Swagger)**: [https://grid-wind-backend.onrender.com/docs](https://grid-wind-backend.onrender.com/docs)
- **Video Walkthrough (Loom/YouTube)**: [https://www.loom.com/share/7eae985190b84a698329506d32ffbdf9](https://www.loom.com/share/7eae985190b84a698329506d32ffbdf9)

---

## Commercial & Market Context

In the UK wholesale power market, market participants lock in their physical delivery nominations in the day-ahead auction (EPEX SPOT) before the market gate closes at **11:00 UTC on D−1** (the day prior to delivery). 

- **Imbalance Risk**: If actual wind outturn falls below physical nominations, the desk is short and must buy balancing volume at volatile Elexon System Buy Price (SBP) cash-out rates. If wind exceeds nominations, long volume is sold off at discounted System Sell Price (SSP).
- **Point-in-Time Discipline**: Forecasts update continuously up until real-time gate closure. However, for a day-ahead contract locked at 11:00 UTC D−1, any forecast released after that gate is commercially inaccessible. Evaluating against later forecasts introduces fatal look-ahead bias.
- **Decision Window**: Northstar Wind Desk freezes the eligible forecast horizon strictly at the selected gate (default: 11:00 UTC D−1), matching the information available to a trader at auction execution.

---

## Key Features

1. **Daily Day-Ahead View**:
   - Interactive settlement period analysis across all 48 half-hourly periods for any target delivery date.
   - Dynamic Decision Gate selector (defaulting to 11:00 UTC D−1).
   - Side-by-side time series chart comparing actual generation (`FUELHH`) vs. gate-frozen forecast (`WINDFOR`).
   - Core KPIs: Total Actual Generation (MWh), Day-Ahead MAE, RMSE, Signed System Bias, and Peak Period Imbalance.

2. **January 2026 Portfolio View**:
   - Macro performance assessment across the entire pilot month.
   - Aggregate error benchmarks: Portfolio MAE, RMSE, and WAPE (Weighted Absolute Percentage Error).
   - Transparent coverage accounting: Tracks expected (1,488), actual, forecast, and paired settlement periods without synthetic backfilling.

3. **Production API Architecture**:
   - FastAPI backend with automated Pydantic schema validation.
   - Local JSON caching layer to guard against third-party API rate limits and optimize response latency.
   - Automated OpenAPI / Swagger documentation.

---

## Technical Architecture & Tech Stack

```text
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI entry point, routing, and CORS
│   │   ├── metrics.py         # Point-in-time forecast alignment & error math
│   │   ├── elexon_client.py   # Elexon BMRS API client and parser
│   │   └── models.py          # Pydantic schemas for daily/monthly responses
│   ├── fetch_elexon.py        # CLI dataset hydration script
│   ├── requirements.txt       # Python dependencies
│   └── Dockerfile             # Multi-stage production container
├── frontend/
│   ├── src/
│   │   ├── components/        # Charting, KPI cards, and gate controls
│   │   ├── App.tsx            # Main operational cockpit view
│   │   └── api.ts             # API client targeting VITE_API_URL
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml         # Local full-stack orchestration
└── README.md
