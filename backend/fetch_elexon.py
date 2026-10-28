import asyncio

from app.elexon_client import refresh_january


if __name__ == "__main__":
    counts = asyncio.run(refresh_january())
    print(f"Cached {counts['actualRows']:,} actual records and {counts['forecastRows']:,} forecast records.")
