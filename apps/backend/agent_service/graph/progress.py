from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import Lock
from typing import Callable


@dataclass(slots=True)
class ProgressEvent:
    stage: str
    status: str
    message: str | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))


class ProgressEmitter:
    def __init__(self) -> None:
        self._callbacks: list[Callable[[ProgressEvent], None]] = []
        self._lock = Lock()

    def subscribe(self, callback: Callable[[ProgressEvent], None]) -> None:
        with self._lock:
            if callback not in self._callbacks:
                self._callbacks.append(callback)

    def unsubscribe(self, callback: Callable[[ProgressEvent], None]) -> None:
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

    def emit(
        self,
        stage: str,
        status: str,
        message: str | None = None,
    ) -> None:
        event = ProgressEvent(
            stage=stage,
            status=status,
            message=message,
        )

        with self._lock:
            callbacks = list(self._callbacks)

        for callback in callbacks:
            try:
                callback(event)
            except Exception:
                pass

    def clear(self) -> None:
        with self._lock:
            self._callbacks.clear()


progress_emitter = ProgressEmitter()