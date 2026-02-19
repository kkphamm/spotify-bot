import urllib.request, urllib.error, json, sys

sys.stdout.reconfigure(encoding="utf-8")

try:
    with urllib.request.urlopen("http://localhost:8000/recommend", timeout=30) as r:
        data = json.loads(r.read())

    print(f"Recommendations  : {data['total']}")
    print(f"Based on         : {data['based_on']} top tracks  ({data['time_range']})")
    print()
    print(f"  {'#':<3} {'Score':>6}  {'Track':<40} {'Artists'}")
    print("  " + "-" * 80)
    for i, t in enumerate(data["recommendations"], 1):
        artists = ", ".join(t["artists"])
        score   = t["similarity_score"]
        print(f"  {i:<3} {score:>6.4f}  {t['name'][:39]:<40} {artists}")

except urllib.error.HTTPError as e:
    print("Error:", json.loads(e.read()))
