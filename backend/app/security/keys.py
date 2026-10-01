from fastapi import Request


def client_key(request: Request) -> str:
    """
    Rate-limit key: first X-Forwarded-For entry if present, else peer address.
    Behind nginx this is the real client; direct :8000 hits can spoof XFF —
    acceptable for a demo, wrong for production. See README.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",", 1)[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"
