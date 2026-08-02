"""
Fixtures for the real Issue 4/Issue 3 migration tests.

Applies the committed test-only production schema replica
(fixtures/production_schema_replica.sql -- NOT a source of truth, see
that file's header) to a blank database, then applies the REAL
migration files from database/ on top -- the same files that get
pasted into the real Supabase SQL editor. This is the formalized,
repeatable version of the manual verification already done by hand
before those migrations were ever shipped.
"""

import os
import pathlib

import psycopg2
import pytest

DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/postgres",
)

FIXTURES_DIR = pathlib.Path(__file__).resolve().parent / "fixtures"
REPO_DATABASE_DIR = pathlib.Path(__file__).resolve().parents[5] / "database"

REPLICA_FILE = FIXTURES_DIR / "production_schema_replica.sql"
REAL_MIGRATION_FILES = [
    "rls_and_admin_users_migration.sql",
    "share_token_hashing_migration.sql",
]


@pytest.fixture()
def db_conn():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture()
def clean_db(db_conn):
    """Drop everything, leaving a genuinely blank database."""
    with db_conn.cursor() as cur:
        cur.execute("drop schema if exists chat cascade;")
        cur.execute("drop schema if exists user_db cascade;")
        cur.execute("drop schema if exists auth cascade;")
        cur.execute("drop table if exists public.contact_messages cascade;")
        cur.execute("drop table if exists public.travel_knowledge cascade;")
        cur.execute("drop function if exists public.match_travel_knowledge cascade;")
        cur.execute("drop function if exists public.set_updated_at cascade;")
        cur.execute("drop function if exists public.current_account_id cascade;")
    yield db_conn


def apply_replica_and_real_migrations(conn):
    """Blank DB -> replica of real production shape -> the REAL,
    repo-committed migration files, in the same order they'd be
    pasted into Supabase's SQL editor."""
    with conn.cursor() as cur:
        cur.execute(REPLICA_FILE.read_text(encoding="utf-8"))
        for name in REAL_MIGRATION_FILES:
            sql = (REPO_DATABASE_DIR / name).read_text(encoding="utf-8")
            cur.execute(sql)
