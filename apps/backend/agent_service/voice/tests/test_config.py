def test_voice_disabled_by_default(monkeypatch):
    monkeypatch.delenv("VOICE_ENABLED", raising=False)
    from voice import config
    assert config.voice_enabled() is False


def test_voice_enabled_when_explicitly_true(monkeypatch):
    monkeypatch.setenv("VOICE_ENABLED", "true")
    from voice import config
    assert config.voice_enabled() is True


def test_voice_disabled_for_any_other_value(monkeypatch):
    monkeypatch.setenv("VOICE_ENABLED", "yes")  # anything but literal "true"
    from voice import config
    assert config.voice_enabled() is False
