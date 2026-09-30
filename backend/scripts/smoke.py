"""Manual smoke test: run all 15 seeded customers through the live API.

Usage (server must be running with a seeded DB, no API key needed):
    python scripts/smoke.py

Fails loudly on any 5xx; prints a decision table for the handoff.
"""

import sys

import httpx

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

# customer_id -> (name, request_text)
CUSTOMERS = {
    1: ("Ada Whitfield", "My order arrived damaged"),
    2: ("Marcus Chen", "The dinner set arrived broken"),
    3: ("Priya Nair", "I received the wrong item"),
    4: ("Sofia Ramirez", "I want a refund for my clearance jumper"),
    5: ("Ethan Brooks", "I would like my money back for the coffee maker"),
    6: ("Hannah Osei", "Please refund my monitor purchase"),
    7: ("Liam Fitzgerald", "My smart TV arrived damaged"),
    8: ("Olivia Grant", "I want a refund for the handbag"),
    9: ("Noah Petrov", "The desk lamp is broken, refund please"),
    10: ("Emma Lindqvist", "I want to return the yoga mat"),
    11: ("Jack O'Donnell", "I need a refund"),
    12: ("Amara Diallo", "Refund the bluetooth speaker"),
    13: ("Felix Nguyen", "I changed my mind about the backpack"),
    14: ("Grace Kimani", "Please refund the stand mixer"),
    15: ("Henry Castellanos", "Refund for the standing desk"),
}


def main() -> int:
    failures = 0
    print(f"Smoke-testing {BASE_URL} — {len(CUSTOMERS)} customers\n")
    print(f"{'id':>3}  {'customer':<22} {'decision':<10} reason")
    for customer_id, (name, text) in CUSTOMERS.items():
        try:
            response = httpx.post(
                f"{BASE_URL}/api/refund-requests",
                json={"customer_id": customer_id, "request_text": text},
                timeout=30,
            )
        except httpx.HTTPError as exc:
            print(f"{customer_id:>3}  {name:<22} ERROR      {exc}")
            failures += 1
            continue
        if response.status_code >= 500:
            print(
                f"{customer_id:>3}  {name:<22} 5xx        {response.status_code}: {response.text[:120]}"
            )
            failures += 1
            continue
        body = response.json()
        reason = (body.get("decision_reason") or "")[:60]
        print(
            f"{customer_id:>3}  {name:<22} {body.get('decision') or '?':<10} {reason}"
        )
    print(f"\n{'PASS' if failures == 0 else f'FAIL ({failures})'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
