"""
Tests for the repeated-suggestions bug.

"Where else can I visit" returned the identical five places every time:
info_request_node called search_places(city) -- a deterministic search --
and sliced [:5], with no memory of what it had already shown.
"""

from unittest.mock import MagicMock, patch

from services import shown_items
from services.shown_items import filter_already_shown, remember_shown


def _places(*names):
    return [{"name": n} for n in names]


class TestFilterAlreadyShown:
    def test_removes_places_already_suggested(self):
        """The actual bug: a second ask must not repeat the first."""
        with patch.object(shown_items, "redis_client") as redis:
            redis.smembers.return_value = {"senso-ji", "shibuya crossing"}

            fresh = filter_already_shown(
                "sess-1",
                "places",
                _places("Senso-ji", "Shibuya Crossing", "Meiji Shrine"),
            )

            assert [p["name"] for p in fresh] == ["Meiji Shrine"]

    def test_matching_ignores_case(self):
        with patch.object(shown_items, "redis_client") as redis:
            redis.smembers.return_value = {"MEIJI SHRINE"}
            fresh = filter_already_shown("s", "places", _places("meiji shrine"))
            assert fresh == []

    def test_handles_bytes_from_redis(self):
        """Clients differ on bytes vs str depending on decode_responses."""
        with patch.object(shown_items, "redis_client") as redis:
            redis.smembers.return_value = {b"senso-ji"}
            fresh = filter_already_shown(
                "s", "places", _places("Senso-ji", "Ueno Park")
            )
            assert [p["name"] for p in fresh] == ["Ueno Park"]

    def test_returns_everything_when_nothing_seen_yet(self):
        with patch.object(shown_items, "redis_client") as redis:
            redis.smembers.return_value = set()
            places = _places("A", "B")
            assert filter_already_shown("s", "places", places) == places

    def test_returns_empty_when_all_have_been_shown(self):
        """Signals exhaustion, so the node can say so instead of
        repeating the first five."""
        with patch.object(shown_items, "redis_client") as redis:
            redis.smembers.return_value = {"a", "b"}
            assert filter_already_shown("s", "places", _places("A", "B")) == []

    def test_falls_open_when_redis_is_down(self):
        """Repeating results beats erroring the whole answer."""
        with patch.object(shown_items, "redis_client") as redis:
            redis.smembers.side_effect = ConnectionError("down")
            places = _places("A", "B")
            assert filter_already_shown("s", "places", places) == places

    def test_no_session_means_no_filtering(self):
        places = _places("A")
        assert filter_already_shown(None, "places", places) == places

    def test_hotels_fall_back_to_city_when_unnamed(self):
        with patch.object(shown_items, "redis_client") as redis:
            redis.smembers.return_value = {"tokyo guest house"}
            fresh = filter_already_shown(
                "s",
                "hotels",
                [{"city": "Tokyo Guest House"}, {"name": "Sarue Guest House"}],
            )
            assert len(fresh) == 1


class TestRememberShown:
    def test_stores_names_and_sets_a_ttl(self):
        with patch.object(shown_items, "redis_client") as redis:
            redis.scard.return_value = 0
            remember_shown("sess-1", "places", _places("Senso-ji", "Ueno Park"))

            key = redis.sadd.call_args.args[0]
            stored = set(redis.sadd.call_args.args[1:])
            assert key == "shown:places:sess-1"
            assert stored == {"senso-ji", "ueno park"}
            redis.expire.assert_called_once()

    def test_resets_once_the_set_grows_too_large(self):
        """A very long conversation shouldn't grow this without bound."""
        with patch.object(shown_items, "redis_client") as redis:
            redis.scard.return_value = shown_items._MAX_REMEMBERED
            remember_shown("s", "places", _places("A"))
            redis.delete.assert_called_once()

    def test_write_failure_is_swallowed(self):
        with patch.object(shown_items, "redis_client") as redis:
            redis.scard.side_effect = ConnectionError("down")
            remember_shown("s", "places", _places("A"))  # must not raise

    def test_ignores_a_missing_session_or_empty_results(self):
        with patch.object(shown_items, "redis_client") as redis:
            remember_shown(None, "places", _places("A"))
            remember_shown("s", "places", [])
            redis.sadd.assert_not_called()


def test_two_asks_in_a_row_return_different_places():
    """End to end on the real bug: the same search, asked twice, must
    not produce the same answer."""
    catalogue = _places("A", "B", "C", "D", "E", "F", "G", "H")
    memory: set[str] = set()

    fake = MagicMock()
    fake.smembers.side_effect = lambda key: set(memory)
    fake.scard.return_value = 0
    fake.sadd.side_effect = lambda key, *names: memory.update(names)

    with patch.object(shown_items, "redis_client", fake):
        first = filter_already_shown("s", "places", catalogue)[:5]
        remember_shown("s", "places", first)

        second = filter_already_shown("s", "places", catalogue)[:5]
        remember_shown("s", "places", second)

    assert [p["name"] for p in first] == ["A", "B", "C", "D", "E"]
    assert [p["name"] for p in second] == ["F", "G", "H"]
    assert not set(p["name"] for p in first) & set(p["name"] for p in second)
