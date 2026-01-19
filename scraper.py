#!/usr/bin/env python3
import json, requests, time, os, urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {
    "Accept": "application/json",
    "Origin": "https://www.easysbc.io",
    "Referer": "https://www.easysbc.io/",
    "User-Agent": "Mozilla/5.0",
    "Host": "api-fc26.easysbc.io",
}
IP = "108.128.170.164"

def fetch(page):
    for _ in range(3):
        try:
            r = requests.get(f"https://{IP}/players?v2&page={page}&sort=rating&rarity=0,1",
                           headers=HEADERS, timeout=30, verify=False)
            return page, r.json().get("players", [])
        except:
            time.sleep(1)
    return page, []

def main():
    os.makedirs("pages", exist_ok=True)

    # Get total pages
    _, first = fetch(1)
    r = requests.get(f"https://{IP}/players?v2&page=1&sort=rating&rarity=0,1", headers=HEADERS, timeout=30, verify=False)
    total = r.json().get("totalPages", 977)

    # Find which pages we already have
    done = set()
    for f in os.listdir("pages"):
        if f.endswith(".json"):
            done.add(int(f.replace(".json", "")))

    todo = [p for p in range(1, total + 1) if p not in done]
    print(f"Total: {total}, Done: {len(done)}, Todo: {len(todo)}")

    # Parallel fetch
    with ThreadPoolExecutor(max_workers=5) as ex:
        futures = {ex.submit(fetch, p): p for p in todo}
        for i, fut in enumerate(as_completed(futures)):
            page, players = fut.result()
            if players:
                with open(f"pages/{page}.json", "w") as f:
                    json.dump(players, f)
            if i % 50 == 0:
                print(f"Progress: {len(done) + i}/{total}")

    # Combine all
    print("Combining...")
    all_players = []
    with open("mappings.json") as f:
        m = json.load(f)
        clubs = {int(k): v for k, v in m["clubs"].items()}
        countries = {int(k): v for k, v in m["countries"].items()}

    for p in range(1, total + 1):
        try:
            with open(f"pages/{p}.json") as f:
                for pl in json.load(f):
                    all_players.append({
                        "id": pl.get("resourceId"),
                        "name": pl.get("name", pl.get("cardName", "?")),
                        "cardName": pl.get("cardName", "?"),
                        "rating": pl.get("rating", 0),
                        "position": pl.get("preferredPosition", ""),
                        "positions": pl.get("possiblePositions", []),
                        "clubId": pl.get("clubId"),
                        "clubName": clubs.get(pl.get("clubId"), "?"),
                        "countryId": pl.get("countryId"),
                        "countryName": countries.get(pl.get("countryId"), "?"),
                        "imageUrl": pl.get("playerUrl", ""),
                    })
        except: pass

    all_players.sort(key=lambda x: -x["rating"])
    with open("players.json", "w") as f:
        json.dump({"players": all_players, "total": len(all_players)}, f)
    print(f"Done! {len(all_players)} players")

if __name__ == "__main__":
    main()
