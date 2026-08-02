"""
Real, repeatable verification of database/rls_and_admin_users_migration.sql
and database/share_token_hashing_migration.sql against a replica of the
real production schema -- formalizes the manual psql verification
already done by hand (2026-07-31) before those migrations were shipped.
"""

import uuid

from conftest import apply_replica_and_real_migrations


def _account_id(clerk_user_id: str) -> str:
    """Same derivation the real app uses (core/auth.py::get_account_id)."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, clerk_user_id))


def test_migrations_apply_to_a_replica_of_the_real_schema(clean_db):
    apply_replica_and_real_migrations(clean_db)

    with clean_db.cursor() as cur:
        cur.execute(
            """
            select relnamespace::regnamespace::text as schema, relname
            from pg_class
            where relnamespace in ('chat'::regnamespace, 'user_db'::regnamespace, 'public'::regnamespace)
              and relkind = 'r'
              and relname in ('sessions','messages','user_profiles','admin_users','subscriptions','contact_messages','travel_knowledge')
              and relrowsecurity = true
            """
        )
        rls_enabled = {(row[0], row[1]) for row in cur.fetchall()}

    # All 7 real tables -- RLS enabled on every one, matching what was
    # manually confirmed live against production (2026-07-31: all 7
    # showed relrowsecurity=true after this exact migration).
    assert rls_enabled == {
        ("chat", "sessions"),
        ("chat", "messages"),
        ("user_db", "user_profiles"),
        ("user_db", "admin_users"),
        ("user_db", "subscriptions"),
        ("public", "contact_messages"),
        ("public", "travel_knowledge"),
    }


def test_migrations_are_idempotent(clean_db):
    apply_replica_and_real_migrations(clean_db)
    # Second application must not raise.
    with clean_db.cursor() as cur:
        for name in ("rls_and_admin_users_migration.sql", "share_token_hashing_migration.sql"):
            from conftest import REPO_DATABASE_DIR
            cur.execute((REPO_DATABASE_DIR / name).read_text(encoding="utf-8"))


def test_rls_isolates_sessions_between_real_derived_accounts(clean_db):
    """
    The real end-to-end check: two accounts, derived the exact way the
    app derives them from a Clerk JWT `sub` claim, each seeing only
    their own session -- matches the live verification done by hand
    against the real bucket/schema before this migration shipped.
    """
    apply_replica_and_real_migrations(clean_db)

    account_a = _account_id("clerk_user_a")
    account_b = _account_id("clerk_user_b")

    with clean_db.cursor() as cur:
        cur.execute(
            "insert into user_db.user_profiles (account_id, email) values (%s, %s), (%s, %s)",
            (account_a, "a@test.com", account_b, "b@test.com"),
        )
        cur.execute(
            "insert into chat.sessions (device_id, account_id, title, status) "
            "values ('dev-a', %s, 'A trip', 'active'), ('dev-b', %s, 'B trip', 'active')",
            (account_a, account_b),
        )

    clean_db.autocommit = False
    try:
        with clean_db.cursor() as cur:
            cur.execute("set local role authenticated;")
            cur.execute(
                "select set_config('request.jwt.claims', %s, true);",
                ('{"sub": "clerk_user_a"}',),
            )
            cur.execute("select title from chat.sessions;")
            visible = {row[0] for row in cur.fetchall()}
        clean_db.commit()
    finally:
        clean_db.autocommit = True

    assert visible == {"A trip"}, f"User A should only see their own session, saw: {visible}"


def test_share_token_columns_and_hash_backfill(clean_db):
    """
    Confirms the hashing migration's real backfill behavior: an
    existing plaintext share_token gets hashed with sha256, matching
    the exact byte-for-byte verification done by hand against real
    production data (2026-07-31: 9 real tokens backfilled correctly).
    """
    apply_replica_and_real_migrations(clean_db)

    with clean_db.cursor() as cur:
        cur.execute(
            "insert into chat.sessions (device_id, title, status) values ('dev-x', 'X trip', 'active') returning id"
        )
        session_id = cur.fetchone()[0]
        cur.execute(
            "insert into chat.messages (session_id, role, content, share_token) "
            "values (%s, 'assistant', 'hi', 'example-token-abc123')",
            (session_id,),
        )

    # Re-run the hashing migration -- its backfill only runs where
    # share_token_hash is still null, so this exercises that path for
    # a row inserted after the first application.
    from conftest import REPO_DATABASE_DIR
    with clean_db.cursor() as cur:
        cur.execute((REPO_DATABASE_DIR / "share_token_hashing_migration.sql").read_text(encoding="utf-8"))
        cur.execute("select share_token_hash, share_token_expires_at from chat.messages where share_token = 'example-token-abc123';")
        row = cur.fetchone()

    import hashlib
    expected_hash = hashlib.sha256(b"example-token-abc123").hexdigest()

    assert row[0] == expected_hash
    assert row[1] is not None
