"""API-layer security hardening: rate-limit keys, limiter wiring, input guards.

Dependency rule (acceptance-checked): this package must NOT import
app.policy or app.ai — it is a pure guard layer around them.
"""
