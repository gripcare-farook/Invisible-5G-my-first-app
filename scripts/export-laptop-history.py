"""Read-only export. Stop the old local server and back up its database first."""
import json
import sqlite3
import sys
from pathlib import Path
source = Path(sys.argv[1]).resolve()
destination = Path(sys.argv[2]).resolve()
if source == destination or destination.exists():
    raise SystemExit('Choose a new export file; existing files are not overwritten')
with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as db:
    db.row_factory = sqlite3.Row
    rows = [dict(row) for row in db.execute('SELECT listing, checked_at, price_cents, stock, seller, condition FROM observations ORDER BY checked_at, id')]
destination.write_text(json.dumps(rows), encoding='utf-8')
print(f'Exported {len(rows)} observations. Keep this personal export out of Git.')
