# Northstar Wind Desk

A small decision-support pilot for a UK day-ahead power desk. It compares national half-hourly wind outturn with the latest Elexon wind forecast available by a configurable decision gate. The January 2026 date range follows the challenge brief. The default gate is 11:00 UTC on D−1.

## What is included

- `backend/app/main.py` — FastAPI endpoints for daily and monthly views, data refresh, and cache health.
- `backend/app/elexon_client.py` — Elexon Insights API client and local JSON cache.
- `backend/fetch_elexon.py` — command-line cache refresh entry point.
- `backend/app/metrics.py` — timestamp normalization, point-in-time forecast selection, daily metrics, and month roll-up with coverage accounting.
- `backend/data/` — mounted location for the downloaded Elexon records.
- `frontend/src/App.tsx` — React dashboard, date and decision-gate controls, KPI cards, and forecast/outturn chart.
- `frontend/src/styles.css` — responsive dark trading-desk interface.
- `docker-compose.yml` — local two-container setup.

## Start the application

Install Docker Desktop, then run from this directory:

```bash
docker compose up --build
```

Open <http://localhost:8080>. The FastAPI service and interactive API docs are available at <http://localhost:8000> and <http://localhost:8000/docs>.

The first run starts with an empty cache. Use **Sync Elexon** in the dashboard or call `POST http://localhost:8000/api/refresh` to retrieve and cache January 2026 records. To run the same ingestion script from the backend container, use `docker compose exec backend python fetch_elexon.py`. The sync requires internet access to Elexon. The dashboard intentionally shows an empty state before data is loaded; it does not invent sample observations.

The API is public and does not require a key. Source: [Elexon Insights Developer Portal](https://developer.data.elexon.co.uk/). The project uses only `FUELHH` filtered to `fuelType=WIND` and `WINDFOR`.

## Analysis

For delivery date D, forecasts with `publishTime` later than the chosen D−1 UTC gate are excluded. For every settlement period, the most recently published eligible forecast is paired with the FUELHH actual. The dashboard reports MAE, RMSE, WAPE, signed mean error (`forecast − actual`), absolute peak period error, and actual energy in MWh (MW × 0.5 hours).

The day view and January summary use paired forecast/actual periods for error metrics. The month view also reports the number of expected settlement periods, actual periods, forecast periods, paired periods, and missing observations. Missing forecasts are excluded from error calculations and remain visible in coverage counts. Elexon values are displayed in MW; generation energy is shown as MWh. This prototype does not estimate demand, thermal procurement volume, or cash-out cost, since those require data outside the challenge scope.

The monthly endpoint is `GET /api/monthly-summary?gate=11:00`; the selected gate is applied consistently across all 31 delivery days.

## Deploy

The frontend is configured for Vercel from the `frontend/` project root. Set `VITE_API_URL` in the Vercel project settings to the deployed backend origin, without a trailing slash. The Vercel configuration builds to `dist` and rewrites browser routes to the Vite entry point.

The root `render.yaml` is a Render Blueprint for the FastAPI backend. Create the service from that Blueprint, then use its public URL as Vercel's `VITE_API_URL`. The backend cache is on the service's local filesystem, which is ephemeral on Render; trigger **Sync Elexon** again after a service restart or redeploy. The same Docker image can be used on Heroku, with `PORT` supplied by the platform.

## Configuration

- `VITE_API_URL` — optional frontend API base URL for separate frontend/backend hosting. Leave empty for the included Docker Compose setup.
- `ELEXON_API_BASE` — optional Elexon API base URL (defaults to `https://data.elexon.co.uk/bmrs/api/v1`).
- `DATA_DIR` — optional backend cache directory (defaults to `backend/data`).

## AI assistance

OpenAI Codex and Gemini were used to assist with application design and implementation.

## Deployment and video

No hosted app URL, public GitHub repository, or demo video has been created in this workspace. Add the deployed application link here after deploying the Dockerized frontend and backend. The challenge asks for a public repository and an unlisted YouTube demo of no more than 10 minutes, with an initial customer overview and a technical walkthrough.
