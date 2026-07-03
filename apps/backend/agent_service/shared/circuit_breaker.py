import time


class CircuitBreaker:
    def __init__(self, failure_threshold=3, recovery_timeout=60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout

        self.failures = 0
        self.last_failure = None

    def can_execute(self):
        if self.failures < self.failure_threshold:
            return True

        if time.time() - self.last_failure > self.recovery_timeout:
            self.failures = 0
            return True

        return False

    def record_success(self):
        self.failures = 0
        self.last_failure = None

    def record_failure(self):
        self.failures += 1
        self.last_failure = time.time()