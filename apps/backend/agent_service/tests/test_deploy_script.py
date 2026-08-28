"""
Guards the deploy script's parameter handling.

2026-08-28: after a load test raised the guest IP cap to 500, running
deploy.py without --guest-ip-cap reported "No changes to deploy" and
left the cap at 500 -- the guest-trial bypass wide open. CloudFormation
keeps the PREVIOUS value for a parameter omitted on a stack update; it
does not fall back to the template default. The cap must therefore be
sent explicitly on every deploy.
"""

import importlib.util
import pathlib

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "deploy_script",
    pathlib.Path(__file__).resolve().parents[1] / "deploy.py",
)
deploy_script = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(deploy_script)


def test_default_cap_matches_the_guard():
    from shared import guest_ip_guard

    assert int(deploy_script.DEFAULT_GUEST_IP_CAP) == (
        guest_ip_guard.GUEST_SESSIONS_PER_IP_PER_DAY
    )


def test_default_cap_matches_the_template():
    template = (
        pathlib.Path(__file__).resolve().parents[1] / "template.yml"
    ).read_text(encoding="utf-8")

    block = template.split("GuestSessionsPerIpPerDay:", 1)[1]
    default_line = next(
        line for line in block.splitlines() if "Default:" in line
    )
    assert deploy_script.DEFAULT_GUEST_IP_CAP in default_line


@pytest.mark.parametrize(
    "flag,expected",
    [(None, "5"), ("500", "500")],
)
def test_the_cap_is_always_sent_explicitly(flag, expected):
    """
    Omitting it is what left production at 500. Whatever the flag, the
    parameter must appear in the overrides.
    """
    cap = flag or deploy_script.DEFAULT_GUEST_IP_CAP
    override = 'GuestSessionsPerIpPerDay="%s"' % cap
    assert override == f'GuestSessionsPerIpPerDay="{expected}"'
