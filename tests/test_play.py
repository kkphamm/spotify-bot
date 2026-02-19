import urllib.request, urllib.error, json, sys

sys.stdout.reconfigure(encoding="utf-8")

def play(message):
    body = json.dumps({"message": message}).encode()
    req = urllib.request.Request(
        "http://localhost:8000/play",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return json.loads(raw)
        except Exception:
            return {"detail": raw.decode(errors="replace")}
    except Exception as e:
        return {"detail": str(e)}

for msg in ["Play hurt by newjeans", "Play newjeans", "Play lofi", "Play BTS"]:
    print(f">>> {msg}")
    r = play(msg)
    if "detail" in r:
        print(f"  ERROR: {r['detail']}")
    elif r.get("mode") == "multi":
        artists = r.get("artists", [])
        print(f"  Mode    : multi ({r['track_count']} tracks, {len(artists)} artists)")
        print(f"  Artists : {', '.join(artists[:5])}{'...' if len(artists) > 5 else ''}")
    elif r.get("mode") == "artist":
        print(f"  Mode    : artist")
        print(f"  Artist  : {r.get('artist')}")
    else:
        print(f"  Mode    : track")
        print(f"  Track   : {r.get('track')} - {', '.join(r.get('artists', []))}")
    print(f"  Shuffle : {r.get('shuffle')}")
    print()
