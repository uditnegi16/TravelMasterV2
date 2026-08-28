#!/usr/bin/env python3
"""
Deploy the agent service.

Same job as deploy.sh, but runs anywhere Python does - no Git Bash needed.

template.yml no longer contains secrets: they are 17 CloudFormation
parameters with no defaults. This reads the values from .env.prod and
passes them to `sam deploy`, so you don't type them by hand.

Usage, from apps/backend/agent_service:

    py deploy.py                # build + deploy
    py deploy.py --print-only   # show what it would run, deploy nothing
    py deploy.py --env .env.staging
"""

import argparse
import os
import shutil
import subprocess
import sys

# .env.prod key  ->  CloudFormation parameter name.
# CloudFormation parameter names must be alphanumeric: no underscores.
PARAM_MAP = {
    "GROQ_API_KEY": "GroqApiKey",
    "GROQ_CLASSIFIER_API_KEY": "GroqClassifierApiKey",
    "GROQ_PLANNER_API_KEY": "GroqPlannerApiKey",
    "OPENTRIPMAP_API_KEY": "OpenTripMapApiKey",
    "DUFFEL_API_TOKEN": "DuffelApiToken",
    "UPSTASH_REDIS_REST_URL": "UpstashRedisRestUrl",
    "UPSTASH_REDIS_REST_TOKEN": "UpstashRedisRestToken",
    "NVIDIA_API_KEY": "NvidiaApiKey",
    "RAZORPAY_KEY_ID": "RazorpayKeyId",
    "RAZORPAY_KEY_SECRET": "RazorpayKeySecret",
    "RAZORPAY_WEBHOOK_SECRET": "RazorpayWebhookSecret",
    "SUPABASE_URL": "SupabaseUrl",
    "SUPABASE_SECRET_KEY": "SupabaseSecretKey",
    "CLERK_SECRET_KEY": "ClerkSecretKey",
    "CLERK_PUBLISHABLE_KEY": "ClerkPublishableKey",
    "CLERK_AUTHORIZED_PARTIES": "ClerkAuthorizedParties",
    "HF_TOKEN": "HfToken",
}
PARAMS = list(PARAM_MAP)

# Must match template.yml's default and guest_ip_guard.py.
DEFAULT_GUEST_IP_CAP = "5"


def die(msg):
    print(f"\nerror: {msg}\n", file=sys.stderr)
    sys.exit(1)


def load_env(path):
    """Read KEY=VALUE without executing anything. Tolerates CRLF and BOM."""
    values = {}
    with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            values[key.strip()] = val.strip().strip('"').strip("'")
    return values


def find_sam():
    """Locate the SAM CLI, including the .cmd shim used on Windows."""
    for name in ("sam", "sam.cmd", "sam.exe"):
        found = shutil.which(name)
        if found:
            return found
    for guess in (
        r"C:\Program Files\Amazon\AWSSAMCLI\bin\sam.cmd",
        r"C:\Program Files (x86)\Amazon\AWSSAMCLI\bin\sam.cmd",
    ):
        if os.path.exists(guess):
            return guess
    return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--env", default=".env.prod")
    p.add_argument(
        "--print-only",
        action="store_true",
        help="show the command with secrets masked; deploy nothing",
    )
    p.add_argument(
        "--guest-ip-cap",
        help=(
            "Raise GuestSessionsPerIpPerDay for a load-test window, e.g. "
            "--guest-ip-cap 500. Redeploy without it afterwards to restore "
            "the real protection."
        ),
    )
    args = p.parse_args()

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    if not os.path.exists("template.yml"):
        die("template.yml not found. Run this from apps/backend/agent_service.")

    if not os.path.exists(args.env):
        die(
            f"{args.env} not found.\n"
            "Prod secrets are not in git by design. Create it with the 17 "
            "keys listed in RUNBOOK.md."
        )

    values = load_env(args.env)

    missing = [k for k in PARAMS if not values.get(k)]
    if missing:
        die(
            f"missing or empty in {args.env}:\n  "
            + "\n  ".join(missing)
        )
    print(f"Loaded {len(PARAMS)} parameters from {args.env}")

    sam = find_sam()

    if args.print_only:
        masked_parts = [f'{PARAM_MAP[k]}="***"' for k in PARAMS]
        masked_parts.append(
            f'GuestSessionsPerIpPerDay="'
            f'{args.guest_ip_cap or DEFAULT_GUEST_IP_CAP}"'
        )
        masked = " ".join(masked_parts)
        shown = sam or "<sam not found on PATH>"
        print(f"Using SAM at {shown}")
        print("\nWould run:")
        print(f"  {shown} build")
        print(f"  {shown} deploy --parameter-overrides " + masked)
        return

    if not sam:
        die(
            "SAM CLI not found on PATH.\n"
            "Check with:  where.exe sam\n"
            "If it isn't installed:\n"
            "  https://docs.aws.amazon.com/serverless-application-model/"
            "latest/developerguide/install-sam-cli.html"
        )
    print(f"Using SAM at {sam}")

    # SAM wants ONE space-joined string, not one argv entry per pair.
    # Values are quoted so commas (CLERK_AUTHORIZED_PARTIES) survive.
    pairs = [
        '%s="%s"' % (PARAM_MAP[k], values[k].replace('"', '\\"')) for k in PARAMS
    ]
    # Always sent explicitly. CloudFormation keeps the PREVIOUS value for
    # a parameter that is omitted on an update -- it does not fall back
    # to the template default. Leaving this out after a load test
    # therefore re-sent 500 and reported "No changes to deploy", quietly
    # leaving the guest-trial bypass wide open.
    cap = args.guest_ip_cap or DEFAULT_GUEST_IP_CAP
    pairs.append('GuestSessionsPerIpPerDay="%s"' % cap)

    if args.guest_ip_cap:
        print(
            f"\n*** Guest IP cap RAISED to {args.guest_ip_cap} for this "
            "deploy.\n*** Run deploy.py without --guest-ip-cap afterwards "
            f"to restore {DEFAULT_GUEST_IP_CAP}."
        )
    else:
        print(f"Guest IP cap: {DEFAULT_GUEST_IP_CAP} (default protection)")
    overrides = " ".join(pairs)

    # Guard against pushing a live payment key without meaning to.
    if values["RAZORPAY_KEY_ID"].startswith("rzp_live_"):
        print("\nWARNING: RAZORPAY_KEY_ID is a LIVE key -- this deploy takes real money.")
        if input("Type 'live' to continue: ").strip() != "live":
            print("aborted.")
            sys.exit(1)

    print("\nBuilding (needs Docker Desktop running)...")
    r = subprocess.run([sam, "build"])
    if r.returncode != 0:
        die(
            "sam build failed.\n"
            "Most common cause: Docker Desktop is not running. This Lambda "
            "is a container image."
        )

    print("\nDeploying...")
    r = subprocess.run([sam, "deploy", "--parameter-overrides", overrides])
    if r.returncode != 0:
        die("sam deploy failed. See the output above.")

    print("\nDone. Test the live site before you walk away.")


if __name__ == "__main__":
    main()