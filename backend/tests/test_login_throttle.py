from app.core import login_throttle
from app.core.login_throttle import FailureThrottle


def test_blocks_after_max_failures_and_reports_wait():
    t = FailureThrottle(max_failures=3, window_seconds=60)
    for _ in range(2):
        t.record("k")
    assert t.retry_after("k") == 0
    t.record("k")
    assert 0 < t.retry_after("k") <= 61


def test_keys_are_independent_and_clear_resets():
    t = FailureThrottle(max_failures=2, window_seconds=60)
    t.record("a"); t.record("a")
    assert t.retry_after("a") > 0
    assert t.retry_after("b") == 0
    t.clear("a")
    assert t.retry_after("a") == 0


def test_failures_expire_after_window(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(login_throttle.time, "monotonic", lambda: now[0])
    t = FailureThrottle(max_failures=2, window_seconds=10)
    t.record("a"); t.record("a")
    assert t.retry_after("a") > 0
    now[0] += 11
    assert t.retry_after("a") == 0


def test_client_ip_prefers_forwarded_header():
    class R:
        headers = {"x-forwarded-for": "1.2.3.4, 10.0.0.1"}
        client = None
    assert login_throttle.client_ip(R()) == "1.2.3.4"

    class R2:
        headers = {}
        class client:
            host = "9.9.9.9"
    assert login_throttle.client_ip(R2()) == "9.9.9.9"
