#!/usr/bin/env python3
"""Measure p50/p95 latency for the notes list endpoint against real MongoDB.

Run from the repo root with the backend virtualenv active:
  python scripts/measure_list_perf.py

Requires MongoDB running with at least 1,000 notes (run seed_notes.py first).
Reads MONGODB_URI, MONGODB_DB, and ENCRYPTION_KEY from the repo-root .env file.

Timing uses Flask's test client (in-process), so results include Flask routing
and service logic but exclude network overhead. This matches NFR-01's definition
of "the endpoint returns results within 2 seconds" in a local deployment.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import statistics
import time

from app import create_app

RUNS = 50
NFR_THRESHOLD_MS = 2000


def _percentile(data: list[float], p: float) -> float:
    data = sorted(data)
    idx = (len(data) - 1) * p / 100.0
    lo = int(idx)
    hi = min(lo + 1, len(data) - 1)
    return data[lo] + (data[hi] - data[lo]) * (idx - lo)


def _measure(client, path: str, label: str, runs: int = RUNS) -> tuple[float, float]:
    latencies: list[float] = []
    for _ in range(runs):
        t0 = time.perf_counter()
        r = client.get(path)
        t1 = time.perf_counter()
        if r.status_code != 200:
            print(f"  ERROR: {label} returned {r.status_code}: {r.data[:200]}")
            sys.exit(1)
        latencies.append((t1 - t0) * 1000)

    p50 = _percentile(latencies, 50)
    p95 = _percentile(latencies, 95)
    flag = "PASS" if p95 < NFR_THRESHOLD_MS else "FAIL"
    print(f"  {label:<46}  p50={p50:6.1f}ms  p95={p95:6.1f}ms  [{flag}]")
    return p50, p95


def main() -> None:
    app = create_app()
    client = app.test_client()

    # Verify dataset size.
    r = client.get("/api/notes?limit=1")
    if r.status_code != 200:
        print(f"Failed to reach /api/notes: {r.status_code}")
        sys.exit(1)
    total = r.get_json().get("total", 0)
    if total < 1000:
        print(
            f"Only {total} non-deleted notes in DB. "
            "Run scripts/seed_notes.py --count 1500 first."
        )
        sys.exit(1)

    print(f"Dataset: {total} notes  |  {RUNS} runs per scenario\n")
    print(f"{'Scenario':<48}  {'p50':>10}  {'p95':>10}  Status")
    print("-" * 80)

    # 1. Unfiltered first page (no q, no type)
    _measure(client, "/api/notes", "unfiltered first page (limit=50)")

    # 2. Type-filtered page
    _measure(client, "/api/notes?type=text", "type=text filter")

    # 3. Text search — single common token present in many seeded titles
    _measure(client, "/api/notes?q=meeting", "text search: q=meeting")

    # 4. Text search combined with type filter
    _measure(client, "/api/notes?q=notes&type=text", "text search q=notes + type=text")

    # 5. Deep paginated page — get page-2 cursor from a fresh request
    r = client.get("/api/notes?limit=50")
    cursor = r.get_json().get("next_cursor")
    if cursor:
        _measure(client, f"/api/notes?cursor={cursor}", "cursor pagination (page 2)")
    else:
        print("  (cursor pagination skipped: fewer than 51 notes returned on page 1)")

    print()
    print(f"NFR-01 threshold: p95 < {NFR_THRESHOLD_MS} ms for all list and filter scenarios.")


if __name__ == "__main__":
    main()
