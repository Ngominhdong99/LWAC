import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use a test database
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["SMTP_SERVER"] = "smtp.test.local"
os.environ["SMTP_PORT"] = "587"
os.environ["EMAIL_USERNAME"] = "noreply@test.local"
os.environ["EMAIL_PASSWORD"] = "test-email-password"
os.environ["EMAIL_FROM_NAME"] = "LWAC Test"
os.environ["EMAIL_COACH_NAME"] = "Test Coach"
os.environ["PLATFORM_URL"] = "https://example.test"

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Now we can import the app modules
from data.master_vocabulary import seed_master_vocabulary
from main import app
from database import get_db
from base import Base
import models
from core.config import pwd_context

# Setup test database engine
engine = create_engine(
    "sqlite:///./test.db", connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    # Setup
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Pre-seed essential data for tests
    db = TestingSessionLocal()
    
    try:
        # Create test users
        coach = models.User(
            username="test_coach",
            email="coach@test.com",
            hashed_password=pwd_context.hash("pass123"),
            role="coach"
        )
        student1 = models.User(
            username="test_student",
            email="student@test.com",
            hashed_password=pwd_context.hash("pass123"),
            role="student"
        )
        db.add(coach)
        db.add(student1)
        db.commit()

        # Create a test lesson
        lesson = models.Lesson(
            title="Test Lesson",
            chapter="Chapter 1",
            type="reading",
            content={"text": "Hello world"}
        )
        db.add(lesson)
        db.commit()

        seed_master_vocabulary(db)

    finally:
        db.close()
        
    yield
    
    # Teardown
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test.db"):
        os.remove("./test.db")


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth_headers(client):
    response = client.post("/auth/login", json={
        "username": "test_student",
        "password": "pass123"
    })
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="module")
def coach_headers(client):
    response = client.post("/auth/login", json={
        "username": "test_coach",
        "password": "pass123"
    })
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}
