"""
BaseRepository — generic CRUD operations using SQLAlchemy v2 select() style.

All subclass repositories extend this to get:
- get(id)
- get_many(ids)
- list()
- create(model_instance)
- delete(model_instance)
"""

from typing import Generic, List, Optional, Type, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Generic SQLAlchemy v2 repository."""

    model: Type[ModelT]

    def __init__(self, session: Session) -> None:
        self.session = session

    # ── Read ──────────────────────────────────────────────────────

    def get(self, id_: int) -> Optional[ModelT]:
        """Fetch a single record by primary key."""
        stmt = select(self.model).where(self.model.id == id_)
        return self.session.execute(stmt).scalars().first()

    def get_many(self, ids: List[int]) -> List[ModelT]:
        """Fetch multiple records by primary keys in one query."""
        if not ids:
            return []
        stmt = select(self.model).where(self.model.id.in_(ids))
        return list(self.session.execute(stmt).scalars().all())

    def get_many_as_map(self, ids: List[int]) -> dict[int, ModelT]:
        """Fetch records by IDs and return a {id: record} dict."""
        return {r.id: r for r in self.get_many(ids)}

    def list_all(self) -> List[ModelT]:
        """Return all records (use carefully on large tables)."""
        stmt = select(self.model)
        return list(self.session.execute(stmt).scalars().all())

    # ── Write ─────────────────────────────────────────────────────

    def add(self, instance: ModelT) -> ModelT:
        """Add a new record (does NOT commit — caller decides)."""
        self.session.add(instance)
        return instance

    def delete(self, instance: ModelT) -> None:
        """Delete a record (does NOT commit — caller decides)."""
        self.session.delete(instance)
