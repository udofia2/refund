"""Input guards for refund request text (defense-in-depth around Pydantic).

Pure stdlib — this module must not import the policy layer nor the AI layer:
it is the guard that runs BEFORE extraction and evaluation see the text.
"""

MAX_REQUEST_TEXT = 2000  # matches Pydantic Field max_length (schemas/refund.py:12)

# Known prompt-injection markers that should always be surfaced as suspicious.
# Intentionally overlaps app.ai.mock_provider.INJECTION_PATTERNS: the mock's
# patterns are the prompt-level guard, these are the API-layer backstop.
INJECTION_MARKERS: tuple[str, ...] = (
    "ignore previous",
    "ignore all previous",
    "disregard previous",
    "you are now",
    "new instructions",
    "system:",
    "assistant:",
    "override",
    "bypass",
    "jailbreak",
)


def detect_injection_markers(text: str) -> list[str]:
    """Case-insensitive substring scan. Returns matched markers (deduped, sorted)."""
    lower = text.lower()
    return sorted({m for m in INJECTION_MARKERS if m in lower})


def normalize_request_text(text: str) -> str:
    """
    - Strip leading/trailing whitespace
    - Reject if, after strip, the text is empty
    - Reject if any char < 0x20 except \\n, \\r, \\t
    - Collapse runs of 3+ newlines to 2
    - Reject if length > MAX_REQUEST_TEXT (defense-in-depth; Pydantic runs first)

    Raises ValueError with a message suitable for a 422 response.
    """
    text = text.strip()
    if not text:
        raise ValueError("Request text must not be empty.")
    for ch in text:
        if ord(ch) < 0x20 and ch not in "\n\r\t":
            raise ValueError("Request text contains invalid control characters.")
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    if len(text) > MAX_REQUEST_TEXT:
        raise ValueError(
            f"Request text must be at most {MAX_REQUEST_TEXT} characters."
        )
    return text
