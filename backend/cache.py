import time
from typing import Any, Optional

_store: dict[str, tuple[float, Any]] = {}


def get(key: str, ttl: int = 900) -> Optional[Any]:
    entry = _store.get(key)
    if entry is None:
        return None
    ts, value = entry
    if time.time() - ts > ttl:
        del _store[key]
        return None
    return value


def set(key: str, value: Any, ttl: int = 900) -> None:  # noqa: A001
    _store[key] = (time.time(), value)


def invalidate(key: str) -> None:
    _store.pop(key, None)
