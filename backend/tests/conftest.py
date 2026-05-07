import mongomock
import pytest

from app import create_app


@pytest.fixture
def app():
    client = mongomock.MongoClient()
    app = create_app(
        {
            "TESTING": True,
            "MONGO_CLIENT": client,
            "MONGODB_DB": "test",
            "SKIP_INDEXES": True,
        }
    )
    return app


@pytest.fixture
def client(app):
    return app.test_client()
