import sqlite3

import os
db = os.path.join(os.path.dirname(__file__), "..", "music.db")
print("File exists :", os.path.exists(db))
print("Size        :", os.path.getsize(db), "bytes")

conn = sqlite3.connect(db)
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
print("Tables      :", [t[0] for t in tables])
print()
for (name,) in tables:
    cols = conn.execute(f"PRAGMA table_info({name})").fetchall()
    col_names = [c[1] for c in cols]
    print(f"  {name}")
    for c in col_names:
        print(f"    - {c}")
conn.close()
