import urllib.request, urllib.error, json, sys

sys.stdout.reconfigure(encoding="utf-8")

try:
    with urllib.request.urlopen("http://localhost:8000/top-tracks?limit=10", timeout=15) as r:
        data = json.loads(r.read())
        print(f"Total: {data['total']}  |  Range: {data['time_range']}\n")
        for t in data["tracks"]:
            artists = ", ".join(t["artists"])
            print(f"  {t['rank']:>2}. {t['name']} - {artists}")
except urllib.error.HTTPError as e:
    print("Error:", json.loads(e.read()))
