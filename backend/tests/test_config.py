from core.config import normalize_database_url


def test_normalize_database_url_converts_postgres_scheme():
    assert (
        normalize_database_url("postgres://user:pass@localhost:5432/lwac")
        == "postgresql://user:pass@localhost:5432/lwac"
    )


def test_normalize_database_url_leaves_postgresql_scheme_unchanged():
    assert (
        normalize_database_url("postgresql://user:pass@localhost:5432/lwac")
        == "postgresql://user:pass@localhost:5432/lwac"
    )
