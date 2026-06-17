"""
Pytest fixtures shared across all test modules.

Uses an in-memory SQLite database — no external dependencies required.
Each test gets a fresh, isolated database via transaction rollback.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.main import app
from app.models.organisation import IndustryType, Organisation
from app.models.user import User, UserRole, UserStatus
from app.services.auth_service import create_access_token
import app.services.auth_service as _auth_svc

# bcrypt 5.x is incompatible with passlib 1.7.x in this environment.
# Patch hash/verify to use SHA-256 so tests don't depend on bcrypt.
import hashlib as _hashlib

def _test_hash(plain: str) -> str:
    return "sha256$" + _hashlib.sha256(plain.encode()).hexdigest()

def _test_verify(plain: str, hashed: str) -> bool:
    return hashed == _test_hash(plain)

def _test_dummy_verify():
    pass

_auth_svc.hash_password = _test_hash
_auth_svc.verify_password = _test_verify

# Also patch the CryptContext to avoid bcrypt calls
class _FakePwdCtx:
    def dummy_verify(self): pass
    def hash(self, plain): return _test_hash(plain)
    def verify(self, plain, hashed): return _test_verify(plain, hashed)

_auth_svc.pwd_ctx = _FakePwdCtx()

def hash_password(plain: str) -> str:
    return _test_hash(plain)

import uuid

TEST_DB_URL = "sqlite:///./test_tvg.db"

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSession(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


def _make_org(db) -> Organisation:
    org = Organisation(
        name=f"Test Org {uuid.uuid4().hex[:6]}",
        industry_type=IndustryType.remittance,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def _make_user(db, role: UserRole, org_id: str = None) -> User:
    if org_id is None:
        org_id = _make_org(db).id
    user = User(
        email=f"{role.value}-{uuid.uuid4().hex[:6]}@test.com",
        full_name=f"Test {role.value.title()}",
        hashed_password=hash_password("TestPassword123!"),
        role=role,
        status=UserStatus.active,
        org_id=org_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _token(user: User) -> str:
    return create_access_token({"sub": user.id, "role": user.role})


def _auth(user: User) -> dict:
    return {"Authorization": f"Bearer {_token(user)}"}


@pytest.fixture
def admin_user(db):
    return _make_user(db, UserRole.admin)


@pytest.fixture
def mlro_user(db):
    return _make_user(db, UserRole.mlro)


@pytest.fixture
def compliance_user(db):
    return _make_user(db, UserRole.compliance)


@pytest.fixture
def analyst_user(db):
    return _make_user(db, UserRole.analyst)


@pytest.fixture
def viewer_user(db):
    return _make_user(db, UserRole.viewer)


@pytest.fixture
def admin_headers(admin_user):
    return _auth(admin_user)


@pytest.fixture
def mlro_headers(mlro_user):
    return _auth(mlro_user)


@pytest.fixture
def compliance_headers(compliance_user):
    return _auth(compliance_user)


@pytest.fixture
def analyst_headers(analyst_user):
    return _auth(analyst_user)


@pytest.fixture
def viewer_headers(viewer_user):
    return _auth(viewer_user)
