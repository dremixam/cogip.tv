#!/usr/bin/env python3
"""
Fetch the current Twitch live status for all COGIP streamers and write
the result to live-status.json.

Required environment variables:
  TWITCH_CLIENT_ID      — Twitch application client ID
  TWITCH_CLIENT_SECRET  — Twitch application client secret
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

TWITCH_CLIENT_ID     = os.environ.get("TWITCH_CLIENT_ID", "")
TWITCH_CLIENT_SECRET = os.environ.get("TWITCH_CLIENT_SECRET", "")
LINKSTACK_API        = "https://linkstack.cogip.tv/api/profiles"
OUTPUT_FILE          = "live-status.json"
TIMEOUT              = 15  # seconds


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def http_get(url: str, headers: dict = None) -> dict:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode())


def http_post(url: str, body: str, headers: dict = None) -> dict:
    req = urllib.request.Request(
        url,
        data=body.encode(),
        method="POST",
        headers=headers or {},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode())


# ---------------------------------------------------------------------------
# Twitch helpers
# ---------------------------------------------------------------------------

def get_app_token() -> str:
    """Obtain a Twitch app access token via the client-credentials flow."""
    body = (
        f"client_id={TWITCH_CLIENT_ID}"
        f"&client_secret={TWITCH_CLIENT_SECRET}"
        f"&grant_type=client_credentials"
    )
    data = http_post(
        "https://id.twitch.tv/oauth2/token",
        body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return data["access_token"]


def get_live_streams(logins: list[str], token: str) -> dict:
    """
    Query Twitch Helix for the given user logins.
    Returns a dict keyed by lowercase login with stream metadata.
    """
    if not logins:
        return {}

    query  = "&".join(f"user_login={u}" for u in logins)
    url    = f"https://api.twitch.tv/helix/streams?{query}"
    data   = http_get(url, headers={
        "Authorization": f"Bearer {token}",
        "Client-Id": TWITCH_CLIENT_ID,
    })

    result = {}
    for stream in data.get("data", []):
        login = stream["user_login"].lower()
        thumb = (
            stream.get("thumbnail_url", "")
            .replace("{width}", "640")
            .replace("{height}", "360")
        )
        result[login] = {
            "title":        stream.get("title", ""),
            "viewer_count": stream.get("viewer_count", 0),
            "game_name":    stream.get("game_name", ""),
            "thumbnail_url": thumb,
            "started_at":   stream.get("started_at", ""),
        }
    return result


# ---------------------------------------------------------------------------
# COGIP profiles helper
# ---------------------------------------------------------------------------

def get_profiles() -> list[dict]:
    data = http_get(LINKSTACK_API)
    return data.get("profiles", [])


def extract_twitch_login(url: str) -> str | None:
    """Return the lowercase Twitch login from a full URL, or None."""
    if not url:
        return None
    login = url.rstrip("/").split("/")[-1].lower()
    return login if login else None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not TWITCH_CLIENT_ID or not TWITCH_CLIENT_SECRET:
        print(
            "ERROR: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("→ Fetching Twitch app token…")
    token = get_app_token()

    print("→ Fetching COGIP profiles…")
    profiles = get_profiles()
    print(f"  {len(profiles)} profile(s) found.")

    logins = []
    for p in profiles:
        login = extract_twitch_login(p.get("twitch"))
        if login:
            logins.append(login)

    print(f"  Twitch logins to check: {logins}")

    print("→ Checking live streams…")
    streams = get_live_streams(logins, token)
    live    = list(streams.keys())
    print(f"  Currently live: {live if live else '(none)'}")

    output = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "live":    live,
        "streams": streams,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=2, ensure_ascii=False)

    print(f"✓ Written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
