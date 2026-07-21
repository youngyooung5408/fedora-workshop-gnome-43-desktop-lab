#!/usr/bin/env python3
"""Market discovery and quote helper for Desktop Lab.

Taiwan data comes from the keyless official TWSE and TPEx OpenAPI services.
International discovery and quotes use a user-provided Twelve Data key.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import ssl
import subprocess
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


TWSE_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
TPEX_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"
TWELVE_BASE = "https://api.twelvedata.com"
CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "desktop-lab-v12"
KEY_FILE = CONFIG_DIR / "twelve-data-key"
CACHE_FILE = CONFIG_DIR / "market-price-cache.json"
USER_AGENT = "desktop-lab-v1.3.1/1.0"


class ProviderError(RuntimeError):
    """A concise error safe to display in the chooser."""


def _request_json(url: str, headers: dict[str, str] | None = None) -> Any:
    request = Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    try:
        with urlopen(request, timeout=12) as response:
            return json.loads(response.read().decode("utf-8", "replace"))
    except HTTPError as error:
        if error.code == 429:
            raise ProviderError("Provider rate limit reached; cached prices remain available") from error
        raise ProviderError(f"Provider HTTP error {error.code}") from error
    except (URLError, TimeoutError, ssl.SSLError) as error:
        # Python/OpenSSL 3.6 rejects the currently deployed TPEx certificate for
        # a missing non-critical SKI. curl still performs normal CA/hostname
        # validation, so use it only for that official endpoint.
        if url.startswith(TPEX_URL):
            try:
                completed = subprocess.run(
                    ["curl", "--fail", "--silent", "--show-error", "--max-time", "12", url],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                return json.loads(completed.stdout)
            except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as fallback_error:
                raise ProviderError("TPEx is temporarily unavailable") from fallback_error
        raise ProviderError("Network unavailable") from error
    except json.JSONDecodeError as error:
        raise ProviderError("Provider returned invalid data") from error


def _clean_price(value: Any) -> str | None:
    text = str(value or "").strip().replace(",", "")
    if not text or text in {"--", "---"}:
        return None
    try:
        return f"{float(text):.2f}"
    except ValueError:
        return None


def parse_twse(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "provider": "twse",
            "symbol": str(row.get("Code", "")).strip(),
            "name": str(row.get("Name", "")).strip(),
            "exchange": "TWSE",
            "currency": "TWD",
            "close": _clean_price(row.get("ClosingPrice")),
        }
        for row in rows
        if str(row.get("Code", "")).strip() and str(row.get("Name", "")).strip()
    ]


def parse_tpex(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "provider": "tpex",
            "symbol": str(row.get("SecuritiesCompanyCode", "")).strip(),
            "name": str(row.get("CompanyName", "")).strip(),
            "exchange": "TPEx",
            "currency": "TWD",
            "close": _clean_price(row.get("Close")),
        }
        for row in rows
        if str(row.get("SecuritiesCompanyCode", "")).strip()
        and str(row.get("CompanyName", "")).strip()
    ]


def parse_twelve_search(payload: dict[str, Any]) -> list[dict[str, str]]:
    if payload.get("status") == "error":
        raise ProviderError(str(payload.get("message") or "Twelve Data search failed"))
    results = []
    for row in payload.get("data") or []:
        symbol = str(row.get("symbol") or "").strip()
        name = str(row.get("instrument_name") or row.get("name") or "").strip()
        exchange = str(row.get("exchange") or row.get("mic_code") or "").strip()
        currency = str(row.get("currency") or "").strip()
        if symbol and name and exchange and currency:
            results.append({
                "provider": "twelve-data",
                "symbol": symbol,
                "name": name,
                "exchange": exchange,
                "currency": currency,
            })
    return results


def parse_twelve_quote(payload: dict[str, Any]) -> str:
    if payload.get("status") == "error" or payload.get("code"):
        raise ProviderError(str(payload.get("message") or "Twelve Data quote failed"))
    price = _clean_price(payload.get("close") or payload.get("price"))
    if not price:
        raise ProviderError("Twelve Data returned no price")
    return price


def read_api_key() -> str:
    env_key = os.environ.get("DESKTOP_LAB_TWELVE_DATA_KEY", "").strip()
    if env_key:
        return env_key
    try:
        return KEY_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def write_api_key(value: str) -> None:
    value = value.strip()
    if not value:
        raise ProviderError("API key cannot be empty")
    CONFIG_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    KEY_FILE.write_text(value + "\n", encoding="utf-8")
    KEY_FILE.chmod(0o600)


def _taiwan_instruments() -> list[dict[str, Any]]:
    errors = []
    instruments: list[dict[str, Any]] = []
    for url, parser in ((TWSE_URL, parse_twse), (TPEX_URL, parse_tpex)):
        try:
            instruments.extend(parser(_request_json(url)))
        except ProviderError as error:
            errors.append(str(error))
    if not instruments and errors:
        raise ProviderError("; ".join(errors))
    return instruments


def _matches(instrument: dict[str, Any], query: str) -> bool:
    folded = query.casefold()
    return folded in str(instrument.get("symbol", "")).casefold() or folded in str(instrument.get("name", "")).casefold()


def search(query: str) -> dict[str, Any]:
    query = " ".join(query.strip().split())
    if not query:
        raise ProviderError("Enter a symbol or company name")
    warning_parts = []
    try:
        taiwan = _taiwan_instruments()
    except ProviderError as error:
        taiwan = []
        warning_parts.append(str(error))
    results = [item for item in taiwan if _matches(item, query)]
    key = read_api_key()
    if key:
        payload = _request_json(
            f"{TWELVE_BASE}/symbol_search?{urlencode({'symbol': query, 'outputsize': 20})}",
            {"Authorization": f"apikey {key}"},
        )
        results.extend(parse_twelve_search(payload))
    else:
        warning_parts.append("Add a Twelve Data API key to search international instruments")

    seen: set[tuple[str, str, str]] = set()
    unique = []
    for item in results:
        key_tuple = (item["provider"], item["symbol"], item["exchange"])
        if key_tuple not in seen:
            seen.add(key_tuple)
            item.pop("close", None)
            unique.append(item)
    unique.sort(key=lambda item: (not item["symbol"].casefold().startswith(query.casefold()), item["symbol"], item["exchange"]))
    return {"ok": True, "results": unique[:24], "warning": "; ".join(warning_parts)}


def _record_key(record: dict[str, Any]) -> str:
    return "|".join(str(record.get(field, "")).strip() for field in ("provider", "symbol", "exchange"))


def _load_cache() -> dict[str, Any]:
    try:
        payload = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_cache(cache: dict[str, Any]) -> None:
    CONFIG_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    CACHE_FILE.chmod(0o600)


def _resolve_legacy(record: dict[str, Any], taiwan: list[dict[str, Any]]) -> dict[str, Any] | None:
    symbol = str(record.get("symbol") or "").strip()
    exact = [item for item in taiwan if item["symbol"].casefold() == symbol.casefold()]
    if len(exact) == 1:
        return {key: exact[0][key] for key in ("provider", "symbol", "name", "exchange", "currency")}
    return None


def quotes(records: list[dict[str, Any]]) -> dict[str, Any]:
    cache = _load_cache()
    try:
        taiwan = _taiwan_instruments()
        taiwan_error = ""
    except ProviderError as error:
        taiwan = []
        taiwan_error = str(error)
    taiwan_by_key = {(item["provider"], item["symbol"]): item for item in taiwan}
    api_key = read_api_key()
    output = []
    migrated = []

    for original in records:
        record = dict(original)
        if record.get("provider") == "legacy":
            resolved = _resolve_legacy(record, taiwan)
            if resolved:
                record = resolved
                migrated.append(resolved)
        cache_key = _record_key(record)
        price = None
        error = ""
        try:
            provider = record.get("provider")
            symbol = str(record.get("symbol") or "")
            if provider in {"twse", "tpex"}:
                item = taiwan_by_key.get((provider, symbol))
                if not item:
                    raise ProviderError(taiwan_error or "Instrument is no longer listed")
                price = item.get("close")
            elif provider == "twelve-data" or provider == "legacy":
                if not api_key:
                    raise ProviderError("Twelve Data API key required")
                params = {"symbol": symbol}
                if record.get("exchange"):
                    params["exchange"] = str(record["exchange"])
                payload = _request_json(
                    f"{TWELVE_BASE}/quote?{urlencode(params)}",
                    {"Authorization": f"apikey {api_key}"},
                )
                price = parse_twelve_quote(payload)
                if provider == "legacy":
                    resolved = {
                        "provider": "twelve-data",
                        "symbol": str(payload.get("symbol") or symbol),
                        "name": str(payload.get("name") or symbol),
                        "exchange": str(payload.get("exchange") or "Unknown"),
                        "currency": str(payload.get("currency") or "Unknown"),
                    }
                    record = resolved
                    migrated.append(resolved)
                    cache_key = _record_key(record)
            else:
                raise ProviderError("Unknown market provider")
            if not price:
                raise ProviderError("Closing price unavailable")
            cache[cache_key] = {"close": price, "updated": int(time.time())}
        except ProviderError as provider_error:
            error = str(provider_error)
            cached = cache.get(cache_key) or {}
            price = cached.get("close")

        output.append({
            "instrument": {key: record.get(key, "") for key in ("provider", "symbol", "name", "exchange", "currency")},
            "close": price,
            "cached": bool(error and price),
            "error": error,
        })

    if any(item.get("close") and not item.get("cached") for item in output):
        _save_cache(cache)
    return {"ok": True, "quotes": output, "migrated": migrated}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("query")
    quotes_parser = subparsers.add_parser("quotes")
    quotes_parser.add_argument("records")
    subparsers.add_parser("set-key")
    args = parser.parse_args(argv)

    try:
        if args.command == "search":
            result = search(args.query)
        elif args.command == "quotes":
            records = json.loads(args.records)
            if not isinstance(records, list):
                raise ProviderError("Invalid instrument configuration")
            result = quotes(records)
        else:
            write_api_key(sys.stdin.read())
            result = {"ok": True, "message": "Twelve Data API key saved"}
    except (ProviderError, json.JSONDecodeError) as error:
        result = {"ok": False, "message": str(error)}
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
