import os

# Force the suite keyless before any app import: a real key injected into the
# container environment from the host .env must never turn tests into live LLM
# calls (factory falls back to the mock provider on an empty key).
os.environ["LLM_API_KEY"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base, get_db
from app.db.seed import build_seed_data
from app.main import app
from app.security.limiter import limiter


@pytest.fixture(autouse=True)
def _rate_limit_off_by_default():
    """Rate limiting is OFF for every test unless a test opts in (test_rate_limit).

    limiter.reset() verified against the installed slowapi: it exists and resets
    the in-memory storage (there is no public .storage attribute — only _storage).
    """
    prev = limiter.enabled
    limiter.enabled = False
    yield
    limiter.enabled = prev
    limiter.reset()


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture
def seeded_db(db_session: Session) -> Session:
    build_seed_data(db_session)
    db_session.commit()
    return db_session


@pytest.fixture
def client(seeded_db: Session):
    def override_get_db():
        yield seeded_db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
