# Earnings Conviction Scanner

A static dashboard of upcoming earnings: beat history, revenue growth,
options-implied moves and how stocks actually moved after past reports.

A scheduled GitHub Action runs the Python data job, builds the React app and
publishes it to GitHub Pages. If too many tickers fail, the job stops and the
last published version stays up.

Educational project, not investment advice. Data comes mainly from Yahoo
Finance, is delayed, and may be wrong or incomplete.

## Run it

```
pip install -r backend/requirements-snapshot.txt
python backend/tests/test_logic.py
cd backend && python snapshot.py ../frontend/public/data
cd ../frontend && npm ci && npm run build:public
```

The site is written to `site/`.
