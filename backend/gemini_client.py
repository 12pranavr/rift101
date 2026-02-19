"""
AI client — uses OpenRouter API with minimax/minimax-m2.5 model.
OpenRouter is OpenAI-compatible, so we use the openai SDK with a custom base_url.
Includes automatic retry with exponential backoff for 429 rate-limit errors.
"""
import os
import re
import time
import logging
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("gemini_client")  # keep same logger name — referenced elsewhere

# ---------------------------------------------------------------------------
# Client setup — OpenRouter is fully OpenAI-compatible
# ---------------------------------------------------------------------------
client = OpenAI(
    api_key=os.environ["OPENROUTER_API_KEY"],
    base_url="https://openrouter.ai/api/v1",
    default_headers={
        "HTTP-Referer": "https://github.com/rift-agent",   # optional but recommended by OR
        "X-Title": "RIFT Autonomous DevOps Agent",
    },
    timeout=60.0,
)

MODEL = "qwen/qwen3-coder-next"

# ---------------------------------------------------------------------------
# Retry config
# ---------------------------------------------------------------------------
MAX_RETRIES = 5
BASE_BACKOFF_S = 10
MAX_BACKOFF_S = 120


def _parse_retry_delay(err_msg: str) -> float | None:
    """Extract server-suggested retry delay from error message, e.g. 'retry in 46s'."""
    match = re.search(r"retry in (\d+(?:\.\d+)?)\s*s", err_msg, re.IGNORECASE)
    if match:
        return float(match.group(1))
    match = re.search(r"'retryDelay':\s*'(\d+)s'", err_msg)
    if match:
        return float(match.group(1))
    return None


def ask_gemini(prompt: str) -> str:
    """
    Send a prompt to the AI model via OpenRouter and return the text response.

    The function is still called ask_gemini for backward compatibility with
    all existing callers (analyzer.py, fixer.py, etc.).

    Automatically retries on 429 rate-limit errors with exponential backoff.
    """
    last_exc = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=8192,
            )
            msg = response.choices[0].message
            # Some models (e.g. deepseek-r1) put the answer in
            # `reasoning_content` and leave `content` as None.
            content = msg.content or getattr(msg, "reasoning_content", None) or ""
            if not content:
                raise ValueError(
                    f"Model returned empty content. Full choice: {response.choices[0]}"
                )
            return content

        except Exception as exc:
            err_str = str(exc)
            last_exc = exc

            # Only retry on rate-limit / quota errors
            is_rate_limit = (
                "429" in err_str
                or "rate" in err_str.lower()
                or "quota" in err_str.lower()
                or "too many" in err_str.lower()
            )

            if not is_rate_limit:
                raise  # non-retryable — propagate immediately

            if attempt >= MAX_RETRIES:
                break  # exhausted retries

            suggested = _parse_retry_delay(err_str)
            wait = min(suggested + 2, MAX_BACKOFF_S) if suggested else min(BASE_BACKOFF_S * (2 ** attempt), MAX_BACKOFF_S)

            logger.warning(
                f"[openrouter] 429 rate-limit on attempt {attempt + 1}/{MAX_RETRIES}. "
                f"Waiting {wait:.1f}s before retry…"
            )
            time.sleep(wait)

    raise RuntimeError(
        f"OpenRouter API failed after {MAX_RETRIES} retries. Last error: {last_exc}"
    )
