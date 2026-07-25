import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

Json = psycopg2.extras.Json

_pool = None


def init_pool():
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(1, 20, dsn=os.environ["DATABASE_URL"])
    return _pool


def query(sql, params=None):
    """Autocommit single-statement query. Returns list of dict rows (or [] for non-SELECT)."""
    pool = init_pool()
    conn = pool.getconn()
    conn.autocommit = True
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or [])
            if cur.description:
                return [dict(r) for r in cur.fetchall()]
            return []
    finally:
        pool.putconn(conn)


def query_one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else None


@contextmanager
def transaction():
    """Yields a RealDictCursor bound to a connection with manual commit/rollback.
    Commits on clean exit, rolls back on exception. Mirrors pool.connect()/client.query('BEGIN') in the Node backend.
    """
    pool = init_pool()
    conn = pool.getconn()
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        pool.putconn(conn)
