import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import data_fetcher as df
import scoring
import trump_fetcher as tf


class Logic(unittest.TestCase):
    def test_yoy_uses_same_quarter_last_year(self):
        dell = [("2026-07-31", 46.971), ("2026-04-30", 43.842), ("2026-01-31", 33.379),
                ("2025-10-31", 27.005), ("2025-07-31", 29.776)]
        rev = [{"date": d, "revenue": v} for d, v in dell]
        self.assertEqual(scoring._revenue_growth_yoy(rev), 57.7)
        self.assertIsNone(scoring._revenue_growth_yoy(rev[:4]))

    def test_reaction_session(self):
        days = [date(2026, 1, d) for d in (5, 6, 7)]
        closes = [100.0, 110.0, 99.0]
        self.assertEqual(df.reaction_move(days, closes, days[1], "bmo"), 10.0)
        self.assertEqual(df.reaction_move(days, closes, days[1], "amc"), -10.0)
        self.assertIsNone(df.reaction_move(days, closes, days[1], None))
        self.assertIsNone(df.reaction_move(days, closes, days[2], "amc"))

    def test_expiry_covers_earnings(self):
        ex = ["2026-11-27", "2026-12-04"]
        today = date(2026, 11, 24)

        def pick(d, session):
            return df.choose_expiry(ex, today, {"date": d, "session": session})

        self.assertEqual(pick("2026-11-24", "amc"), ("2026-11-27", True))
        self.assertEqual(pick("2026-11-27", "amc"), ("2026-12-04", True))
        self.assertEqual(pick("2026-11-27", "bmo"), ("2026-11-27", True))
        far = df.choose_expiry(ex + ["2027-03-19"], today, {"date": "2027-02-24", "session": "amc"})
        self.assertEqual(far, ("2026-12-04", False))
        self.assertEqual(df.choose_expiry(ex, today, None), ("2026-12-04", False))

    def test_option_price(self):
        self.assertEqual(df._option_price({"bid": 1, "ask": 2, "lastPrice": 9}), 1.5)
        self.assertEqual(df._option_price({"bid": 0, "ask": 0, "lastPrice": 9}), 9)
        self.assertIsNone(df._option_price({"bid": 0, "ask": 0, "lastPrice": float("nan")}))

    def test_trump_matching(self):
        self.assertTrue(tf.is_match("Donald Trump praises Dell", "DELL", "Dell"))
        self.assertFalse(tf.is_match("Eric Trump slams Dell", "DELL", "Dell"))
        self.assertFalse(tf.is_match("Trump picks C-suite ally", "C", "Citigroup"))
        self.assertFalse(tf.is_match("Trump raises student Visa fee", "V", "Visa"))
        self.assertFalse(tf.is_match("Trump meets VP JD Vance", "JD", "JD"))
        self.assertFalse(tf.is_match("Trump speaks - Palantir Technologies", "PLTR", "Palantir"))
        self.assertEqual(tf.company_name("DELL", "Dell Technologies Inc."), "Dell")
        self.assertEqual(tf.company_name("AMZN", "Amazon.com, Inc."), "Amazon")


if __name__ == "__main__":
    unittest.main()
