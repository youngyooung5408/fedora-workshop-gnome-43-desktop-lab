#!/usr/bin/env python3
from __future__ import annotations

import json
import selectors
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

LOCAL_TZ = ZoneInfo.now().key if hasattr(ZoneInfo, 'now') else None


def get_local_tz() -> ZoneInfo:
    try:
        return datetime.now().astimezone().tzinfo  # type: ignore[return-value]
    except Exception:
        return timezone.utc


LOCAL_TZINFO = get_local_tz()
HOME = Path.home()
SESSIONS_DIR = HOME / '.codex' / 'sessions'
CODEX_BIN = HOME / '.local' / 'bin' / 'codex'
CODEX_CMD = [str(CODEX_BIN if CODEX_BIN.exists() else 'codex'), 'app-server', '--listen', 'stdio://']
LIVE_TIMEOUT_SECONDS = 10


def format_reset(ts: int | None) -> str | None:
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(LOCAL_TZINFO).strftime('%Y-%m-%d %H:%M:%S %Z')


def format_now_local(dt: datetime) -> str:
    return dt.astimezone(LOCAL_TZINFO).strftime('%Y-%m-%d %H:%M:%S %Z')


def level_from_remaining(percent: float) -> str:
    if percent <= 20:
        return 'low'
    if percent <= 50:
        return 'medium'
    return 'high'


def parse_iso8601(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace('Z', '+00:00'))
    except ValueError:
        return None


def codex_rpc_messages() -> list[dict[str, Any]]:
    return [
        {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'initialize',
            'params': {
                'clientInfo': {'name': 'gnome-codex-usage', 'version': '1.0'},
                'capabilities': {'experimentalApi': True},
            },
        },
        {
            'jsonrpc': '2.0',
            'id': 2,
            'method': 'account/rateLimits/read',
            'params': None,
        },
    ]


def query_live_rate_limits() -> dict[str, Any] | None:
    try:
        proc = subprocess.Popen(
            CODEX_CMD,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
    except Exception:
        return None

    try:
        assert proc.stdin is not None
        assert proc.stdout is not None
        assert proc.stderr is not None

        for msg in codex_rpc_messages():
            proc.stdin.write(json.dumps(msg) + '\n')
        proc.stdin.flush()

        selector = selectors.DefaultSelector()
        selector.register(proc.stdout, selectors.EVENT_READ)
        selector.register(proc.stderr, selectors.EVENT_READ)

        deadline = datetime.now(timezone.utc).timestamp() + LIVE_TIMEOUT_SECONDS
        while datetime.now(timezone.utc).timestamp() < deadline:
            events = selector.select(timeout=0.5)
            for key, _ in events:
                stream = key.fileobj
                line = stream.readline()
                if not line:
                    continue
                if stream is proc.stdout:
                    try:
                        obj = json.loads(line)
                    except Exception:
                        continue
                    if obj.get('id') == 2 and isinstance(obj.get('result'), dict):
                        try:
                            proc.terminate()
                        except Exception:
                            pass
                        return obj['result']
        try:
            proc.terminate()
        except Exception:
            pass
        return None
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
        return None


def latest_token_count() -> dict[str, Any] | None:
    latest: dict[str, Any] | None = None
    latest_dt: datetime | None = None
    for file_path in SESSIONS_DIR.glob('**/*.jsonl'):
        try:
            with file_path.open('r', encoding='utf-8') as fh:
                for line in fh:
                    try:
                        obj = json.loads(line)
                    except Exception:
                        continue
                    if obj.get('type') != 'event_msg':
                        continue
                    payload = obj.get('payload', {})
                    if payload.get('type') != 'token_count':
                        continue
                    ts = obj.get('timestamp')
                    ts_dt = parse_iso8601(ts)
                    if ts_dt is None:
                        continue
                    if latest_dt is None or ts_dt > latest_dt:
                        latest_dt = ts_dt
                        latest = {
                            'timestamp': ts,
                            'file': str(file_path),
                            'payload': payload,
                        }
        except Exception:
            continue
    return latest


def build_staleness(now_utc: datetime, source_dt: datetime | None, primary: dict[str, Any], secondary: dict[str, Any]) -> dict[str, Any]:
    reasons: list[str] = []
    stale = False

    if source_dt is None:
        stale = True
        reasons.append('missing_source_timestamp')
    else:
        age_seconds = int((now_utc - source_dt).total_seconds())
        if age_seconds > 1800:
            stale = True
            reasons.append('source_older_than_30_minutes')

        for label, bucket in (('primary', primary), ('weekly', secondary)):
            reset_ts = bucket.get('resets_at')
            if reset_ts and source_dt.timestamp() < reset_ts <= now_utc.timestamp():
                stale = True
                reasons.append(f'{label}_window_reset_after_source_event')

    return {
        'stale': stale,
        'reasons': reasons,
        'source_age_seconds': None if source_dt is None else int((now_utc - source_dt).total_seconds()),
    }


def build_status_from_live(result: dict[str, Any], now_local: datetime, now_utc: datetime) -> dict[str, Any]:
    rate = (result.get('rateLimitsByLimitId') or {}).get('codex') or result.get('rateLimits') or {}
    primary = rate.get('primary') or {}
    secondary = rate.get('secondary') or {}
    credits = rate.get('credits') or {}

    primary_used = float(primary.get('usedPercent') or 0.0)
    secondary_used = float(secondary.get('usedPercent') or 0.0)
    primary_left = max(0.0, 100.0 - primary_used)
    secondary_left = max(0.0, 100.0 - secondary_used)
    min_left = min(primary_left, secondary_left)

    return {
        'ok': True,
        'generated_at': format_now_local(now_local),
        'source': 'live_app_server',
        'source_timestamp': now_utc.isoformat(),
        'source_file': None,
        'stale': False,
        'stale_reasons': [],
        'source_age_seconds': 0,
        'plan_type': rate.get('planType'),
        'limit_id': rate.get('limitId'),
        'severity': level_from_remaining(min_left),
        'primary': {
            'label': '5-hour',
            'used_percent': primary_used,
            'remaining_percent': primary_left,
            'window_minutes': primary.get('windowDurationMins'),
            'resets_at': primary.get('resetsAt'),
            'resets_at_local': format_reset(primary.get('resetsAt')),
        },
        'weekly': {
            'label': 'Weekly',
            'used_percent': secondary_used,
            'remaining_percent': secondary_left,
            'window_minutes': secondary.get('windowDurationMins'),
            'resets_at': secondary.get('resetsAt'),
            'resets_at_local': format_reset(secondary.get('resetsAt')),
        },
        'credits': {
            'has_credits': credits.get('hasCredits'),
            'unlimited': credits.get('unlimited'),
            'balance': credits.get('balance'),
        },
    }


def build_status_from_fallback(latest: dict[str, Any], now_local: datetime, now_utc: datetime) -> dict[str, Any]:
    payload = latest['payload']
    source_dt = parse_iso8601(latest.get('timestamp'))
    info = payload.get('info', {})
    rate = payload.get('rate_limits', {})
    primary = rate.get('primary', {})
    secondary = rate.get('secondary', {})
    primary_percent = float(primary.get('used_percent') or 0.0)
    secondary_percent = float(secondary.get('used_percent') or 0.0)
    primary_left = max(0.0, 100.0 - primary_percent)
    secondary_left = max(0.0, 100.0 - secondary_percent)
    min_left = min(primary_left, secondary_left)
    staleness = build_staleness(now_utc, source_dt, primary, secondary)

    return {
        'ok': True,
        'generated_at': format_now_local(now_local),
        'source': 'session_log_fallback',
        'source_timestamp': latest.get('timestamp'),
        'source_file': latest.get('file'),
        'stale': staleness['stale'],
        'stale_reasons': staleness['reasons'],
        'source_age_seconds': staleness['source_age_seconds'],
        'plan_type': rate.get('plan_type'),
        'limit_id': rate.get('limit_id'),
        'severity': level_from_remaining(min_left),
        'primary': {
            'label': '5-hour',
            'used_percent': primary_percent,
            'remaining_percent': primary_left,
            'window_minutes': primary.get('window_minutes'),
            'resets_at': primary.get('resets_at'),
            'resets_at_local': format_reset(primary.get('resets_at')),
        },
        'weekly': {
            'label': 'Weekly',
            'used_percent': secondary_percent,
            'remaining_percent': secondary_left,
            'window_minutes': secondary.get('window_minutes'),
            'resets_at': secondary.get('resets_at'),
            'resets_at_local': format_reset(secondary.get('resets_at')),
        },
        'credits': {
            'has_credits': None,
            'unlimited': None,
            'balance': None,
        },
        'tokens': {
            'total': info.get('total_token_usage', {}).get('total_tokens'),
            'last': info.get('last_token_usage', {}).get('total_tokens'),
            'context_window': info.get('model_context_window'),
        },
    }


def build_status() -> dict[str, Any]:
    now_local = datetime.now().astimezone()
    now_utc = now_local.astimezone(timezone.utc)

    live = query_live_rate_limits()
    if live:
        return build_status_from_live(live, now_local, now_utc)

    latest = latest_token_count()
    if latest:
        status = build_status_from_fallback(latest, now_local, now_utc)
        status['stale'] = True
        if 'live_query_failed' not in status['stale_reasons']:
            status['stale_reasons'].insert(0, 'live_query_failed')
        return status

    return {
        'ok': False,
        'generated_at': format_now_local(now_local),
        'source': 'none',
        'stale': True,
        'stale_reasons': ['live_query_failed', 'no_codex_token_count_telemetry_found'],
        'message': 'No live Codex rate-limit data or fallback token_count telemetry found.',
    }


def main() -> None:
    print(json.dumps(build_status()))


if __name__ == '__main__':
    main()
