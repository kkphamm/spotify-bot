import json
import logging
import re
from typing import Any

from openai import OpenAI, APIStatusError

from backend.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

# Keyword patterns used when OpenAI is unavailable
_PLAY_TRIGGERS      = re.compile(r"\b(play|put on|start|listen to|queue)\b", re.I)
_SEARCH_TRIGGERS    = re.compile(r"\b(search|find|look up|show me|what is)\b", re.I)
_RECOMMEND_TRIGGERS = re.compile(r"\b(recommend|suggest|similar to|like|vibe)\b", re.I)
_DEVICES_TRIGGERS   = re.compile(r"\b(device|devices|speaker|player|where)\b", re.I)
_USER_TRIGGERS      = re.compile(r"\b(who am i|logged in|my account|my profile)\b", re.I)
# Strip leading action words to extract the raw query
_STRIP_PREFIX       = re.compile(
    r"^(play|put on|start|listen to|queue|search|find|look up|show me|"
    r"recommend|suggest|something like|songs like|music like)\s+",
    re.I,
)

INTENT_TOOL = {
    "type": "function",
    "function": {
        "name": "resolve_intent",
        "description": (
            "Parse the user's natural language music request and return a structured intent. "
            "Always call this function — never respond with plain text."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": [
                        "play_music",
                        "search_music",
                        "get_recommendations",
                        "get_current_user",
                        "list_devices",
                        "unknown",
                    ],
                    "description": "The action the user wants to perform.",
                },
                "query": {
                    "type": "string",
                    "description": (
                        "The search term, artist, song title, or genre extracted from the request. "
                        "Empty string if not applicable."
                    ),
                },
                "extras": {
                    "type": "object",
                    "description": "Any additional structured parameters (e.g. limit, genre, mood).",
                    "additionalProperties": True,
                },
            },
            "required": ["action", "query"],
        },
    },
}

SYSTEM_PROMPT = """You are a music assistant that interprets user requests into structured actions.

Available actions:
- play_music     : user wants to play a song, artist, album, or playlist
- search_music   : user wants to search or find music without playing it
- get_recommendations : user wants song or artist recommendations
- get_current_user    : user asks who is logged in
- list_devices        : user wants to see available playback devices
- unknown             : request is unclear or unrelated to music

Always call the resolve_intent function. Never reply with plain text."""


class IntentEngine:
    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.model = "gpt-4o-mini"

    def parse(self, user_input: str) -> dict[str, Any]:
        """
        Parse natural language input into a structured intent dict.

        Tries OpenAI function calling first; falls back to keyword matching
        if the API is unavailable or over quota.

        Returns:
            {
                "action": "play_music",
                "query": "Drake",
                "extras": {},
                "source": "openai" | "fallback"
            }
        """
        logger.info("Parsing intent for: %r", user_input)

        try:
            intent = self._parse_with_openai(user_input)
            intent["source"] = "openai"
            return intent
        except APIStatusError as exc:
            logger.warning("OpenAI unavailable (%s) — using keyword fallback.", exc.status_code)
            intent = self._parse_with_keywords(user_input)
            intent["source"] = "fallback"
            return intent

    def _parse_with_openai(self, user_input: str) -> dict[str, Any]:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
            ],
            tools=[INTENT_TOOL],
            tool_choice={"type": "function", "function": {"name": "resolve_intent"}},
        )

        message = response.choices[0].message

        if not message.tool_calls:
            logger.warning("No tool call returned — returning unknown intent.")
            return {"action": "unknown", "query": "", "extras": {}}

        try:
            intent = json.loads(message.tool_calls[0].function.arguments)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse tool call JSON: %s", exc)
            return {"action": "unknown", "query": "", "extras": {}}

        intent.setdefault("extras", {})
        logger.info("OpenAI intent: %s", intent)
        return intent

    @staticmethod
    def _parse_with_keywords(user_input: str) -> dict[str, Any]:
        text = user_input.strip()

        if _USER_TRIGGERS.search(text):
            return {"action": "get_current_user", "query": "", "extras": {}}

        if _DEVICES_TRIGGERS.search(text):
            return {"action": "list_devices", "query": "", "extras": {}}

        # Strip action verb to get the bare query
        query = _STRIP_PREFIX.sub("", text).strip()

        if _RECOMMEND_TRIGGERS.search(text):
            return {"action": "get_recommendations", "query": query, "extras": {}}

        if _SEARCH_TRIGGERS.search(text):
            return {"action": "search_music", "query": query, "extras": {}}

        if _PLAY_TRIGGERS.search(text):
            return {"action": "play_music", "query": query, "extras": {}}

        # No keyword matched — treat whole input as a play query
        return {"action": "play_music", "query": text, "extras": {}}
