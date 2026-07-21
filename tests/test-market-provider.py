#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
HELPER = ROOT / "profiles/vm-initial-desktop-task/extensions/desktop-lab-v12@young/market_provider.py"
SPEC = importlib.util.spec_from_file_location("market_provider", HELPER)
market = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(market)


class MarketProviderTests(unittest.TestCase):
    def test_twse_parser_and_company_search(self):
        rows = [{"Code": "2330", "Name": "台積電", "ClosingPrice": "1,465.00"}]
        instruments = market.parse_twse(rows)
        self.assertEqual(instruments[0], {
            "provider": "twse", "symbol": "2330", "name": "台積電",
            "exchange": "TWSE", "currency": "TWD", "close": "1465.00",
        })
        self.assertTrue(market._matches(instruments[0], "台積"))

    def test_tpex_parser(self):
        rows = [{"SecuritiesCompanyCode": "6488", "CompanyName": "環球晶", "Close": "1265.00"}]
        self.assertEqual(market.parse_tpex(rows)[0]["exchange"], "TPEx")

    def test_twelve_search_requires_complete_verified_metadata(self):
        payload = {"data": [
            {"symbol": "AAPL", "instrument_name": "Apple Inc", "exchange": "NASDAQ", "currency": "USD"},
            {"symbol": "BAD", "instrument_name": "Incomplete"},
        ]}
        self.assertEqual([item["symbol"] for item in market.parse_twelve_search(payload)], ["AAPL"])

    def test_rate_limit_message(self):
        with mock.patch.object(market, "urlopen", side_effect=market.HTTPError("url", 429, "", {}, None)):
            with self.assertRaisesRegex(market.ProviderError, "rate limit"):
                market._request_json("https://api.twelvedata.com/quote?symbol=AAPL")

    def test_api_key_is_owner_only(self):
        with tempfile.TemporaryDirectory() as directory:
            key_file = Path(directory) / "desktop-lab-v12" / "twelve-data-key"
            with mock.patch.object(market, "CONFIG_DIR", key_file.parent), \
                 mock.patch.object(market, "KEY_FILE", key_file):
                market.write_api_key("secret-test-key")
            self.assertEqual(key_file.stat().st_mode & 0o777, 0o600)
            self.assertEqual(key_file.read_text(encoding="utf-8"), "secret-test-key\n")

    def test_legacy_taiwan_record_migrates_after_quote_resolution(self):
        rows = market.parse_twse([{"Code": "2330", "Name": "台積電", "ClosingPrice": "1465"}])
        with tempfile.TemporaryDirectory() as directory, \
             mock.patch.object(market, "CONFIG_DIR", Path(directory)), \
             mock.patch.object(market, "CACHE_FILE", Path(directory) / "cache.json"), \
             mock.patch.object(market, "_taiwan_instruments", return_value=rows), \
             mock.patch.object(market, "read_api_key", return_value=""):
            payload = market.quotes([{"provider": "legacy", "symbol": "2330", "name": "2330", "exchange": "", "currency": ""}])
        self.assertEqual(payload["quotes"][0]["instrument"]["provider"], "twse")
        self.assertEqual(payload["quotes"][0]["close"], "1465.00")

    def test_offline_quote_uses_last_successful_cache(self):
        record = {"provider": "twse", "symbol": "2330", "name": "台積電", "exchange": "TWSE", "currency": "TWD"}
        key = market._record_key(record)
        with tempfile.TemporaryDirectory() as directory:
            cache_path = Path(directory) / "cache.json"
            cache_path.write_text(json.dumps({key: {"close": "999.00", "updated": 1}}), encoding="utf-8")
            with mock.patch.object(market, "CACHE_FILE", cache_path), \
                 mock.patch.object(market, "_taiwan_instruments", side_effect=market.ProviderError("offline")), \
                 mock.patch.object(market, "read_api_key", return_value=""):
                payload = market.quotes([record])
        self.assertEqual(payload["quotes"][0]["close"], "999.00")
        self.assertTrue(payload["quotes"][0]["cached"])


if __name__ == "__main__":
    unittest.main()
