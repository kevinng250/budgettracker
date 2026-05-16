"""Vision-LLM-powered receipt parsing using Claude Haiku 4.5 with tool use."""

import base64
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

MODEL_ID = "claude-haiku-4-5"

RECEIPT_TOOL = {
    "name": "record_receipt",
    "description": "Record the parsed contents of a grocery / retail receipt.",
    "input_schema": {
        "type": "object",
        "properties": {
            "merchant": {
                "type": "string",
                "description": "Store / merchant name printed on the receipt.",
            },
            "purchase_date": {
                "type": "string",
                "description": "Purchase date in YYYY-MM-DD. Use the printed date; if not visible, omit.",
            },
            "subtotal": {"type": "number"},
            "tax": {"type": "number"},
            "total": {
                "type": "number",
                "description": "Grand total charged. Required.",
            },
            "line_items": {
                "type": "array",
                "description": "Every purchased item on the receipt. Include discounts as separate entries with is_discount=true and a negative line_total. Skip non-purchase rows like 'thank you', loyalty summaries, or balance-of-payment lines.",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "quantity": {"type": "number"},
                        "unit_price": {"type": "number"},
                        "line_total": {
                            "type": "number",
                            "description": "Signed line total: positive for items, negative for discounts.",
                        },
                        "is_discount": {"type": "boolean"},
                        "suggested_tag": {
                            "type": "string",
                            "description": "Best matching tag from the provided known_tags list; fall back to 'other' if none fit.",
                        },
                    },
                    "required": ["description", "line_total"],
                },
            },
        },
        "required": ["line_items", "total"],
    },
}


def parse_receipt(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    known_tags: Optional[list[str]] = None,
) -> dict:
    """Send the receipt image to Claude Haiku 4.5 and return the structured tool args.

    Raises RuntimeError on missing API key or unexpected response shape.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY environment variable is not set. "
            "Export it in the shell that runs the Flask backend."
        )

    # Imported lazily so the rest of the app boots without the SDK installed.
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)

    tag_hint = ""
    if known_tags:
        joined = ", ".join(sorted(set(known_tags)))
        tag_hint = (
            f"\n\nKnown tags to choose from for suggested_tag (use 'other' if none fit): {joined}"
        )

    prompt = (
        "This is a photo of a retail/grocery receipt. Extract every purchased "
        "line item using the record_receipt tool. Treat coupons and BOGO "
        "discount lines as separate entries with is_discount=true and a "
        "negative line_total. Skip rewards summaries, balance lines, and "
        "thank-you text. If you cannot read a field reliably, omit it rather "
        "than guess."
        + tag_hint
    )

    b64 = base64.standard_b64encode(image_bytes).decode("ascii")

    response = client.messages.create(
        model=MODEL_ID,
        max_tokens=4096,
        tools=[RECEIPT_TOOL],
        tool_choice={"type": "tool", "name": "record_receipt"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "record_receipt":
            return block.input

    raise RuntimeError(
        f"Claude did not return a record_receipt tool call. stop_reason={response.stop_reason}"
    )
