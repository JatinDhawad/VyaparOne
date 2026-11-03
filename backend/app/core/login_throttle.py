"""Small in-memory throttle for failed login attempts.

Keeps the public /auth/login endpoint from being used for password guessing.
State lives in process memory, which is fine for a single-instance deployment;
it resets on restart. Use a shared store (e.g. Redis) if you ever run several instances.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request


class FailureThrottle:
    def __init__(self, max_failures: int, window_seconds: int):
        self.max_failures = max_failures
        self.window = window_seconds
        self._failures = defaultdict(deque)
        self._lock = Lock()

    def _prune(self, key: str, now: float) -> deque:
        q = self._failures[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if not q:
            self._failures.pop(key, None)
            return deque()
        return q

    def retry_after(self, key: str) -> int:
        """Seconds until another attempt is allowed (0 if not blocked)."""
        now = time.monotonic()
        with self._lock:
            q = self._prune(key, now)
            if len(q) >= self.max_failures:
                return max(1, int(self.window - (now - q[0])) + 1)
            return 0

    def record(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            self._failures[key].append(now)

    def clear(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


# Per client + account: stops one machine guessing at one account.
ip_account_throttle = FailureThrottle(max_failures=5, window_seconds=15 * 60)
# Per account across all clients: backstop if the client address is spoofed or distributed.
account_throttle = FailureThrottle(max_failures=20, window_seconds=15 * 60)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
