"""
Query builder utilities for efficient database queries.
Centralizes common patterns and prevents N+1 queries.
"""

from typing import List, Optional, Type, TypeVar, Any
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

T = TypeVar("T")


class QueryBuilder:
    """Fluent query builder for SQLAlchemy models."""

    def __init__(self, model: Type[T], session: Session):
        self.model = model
        self.session = session
        self._query = select(model)
        self._filters_applied = []
        self._options = []

    def where(self, *conditions) -> "QueryBuilder":
        """Add WHERE conditions."""
        for condition in conditions:
            self._filters_applied.append(condition)
        return self

    def filter_by(self, **kwargs) -> "QueryBuilder":
        """Add equality filters: .filter_by(name='value')."""
        for key, value in kwargs.items():
            if hasattr(self.model, key):
                self._filters_applied.append(getattr(self.model, key) == value)
        return self

    def order_by(self, *order_clauses) -> "QueryBuilder":
        """Add ORDER BY clauses."""
        self._query = self._query.order_by(*order_clauses)
        return self

    def limit(self, count: int) -> "QueryBuilder":
        """Add LIMIT clause."""
        self._query = self._query.limit(count)
        return self

    def offset(self, count: int) -> "QueryBuilder":
        """Add OFFSET clause."""
        self._query = self._query.offset(count)
        return self

    def options(self, *options) -> "QueryBuilder":
        """Add eager loading options (joinedload, selectinload)."""
        self._options.extend(options)
        return self

    def _build(self) -> Any:
        """Build final query with all filters and options."""
        query = self._query

        if self._filters_applied:
            for condition in self._filters_applied:
                query = query.where(condition)

        if self._options:
            query = query.options(*self._options)

        return query

    def execute(self) -> Any:
        """Execute query and return raw result."""
        return self.session.execute(self._build())

    def scalars(self) -> Any:
        """Execute and return scalar results (single model instances)."""
        return self.execute().scalars()

    def all(self) -> List[T]:
        """Execute and return all results as list."""
        return list(self.scalars().all())

    def first(self) -> Optional[T]:
        """Execute and return first result or None."""
        return self.scalars().first()

    def one(self) -> T:
        """Execute and return exactly one result (raises if 0 or >1)."""
        return self.scalars().one()

    def one_or_none(self) -> Optional[T]:
        """Execute and return one result or None (raises if >1)."""
        return self.scalars().one_or_none()

    def count(self) -> int:
        """Return count of matching rows."""
        count_query = select(func.count()).select_from(self._build().subquery())
        return self.session.execute(count_query).scalar_one()

    def exists(self) -> bool:
        """Check if any matching row exists."""
        exists_query = select(1).where(*self._filters_applied).limit(1)
        result = self.session.execute(exists_query).first()
        return result is not None

    def update(self, **values) -> int:
        """Build and execute UPDATE statement."""
        stmt = update(self.model)
        for condition in self._filters_applied:
            stmt = stmt.where(condition)
        stmt = stmt.values(**values)
        result = self.session.execute(stmt)
        return result.rowcount

    def delete(self) -> int:
        """Build and execute DELETE statement."""
        stmt = delete(self.model)
        for condition in self._filters_applied:
            stmt = stmt.where(condition)
        result = self.session.execute(stmt)
        return result.rowcount


def batch_fetch_ids(
    session: Session, model: Type[T], id_list: List[int], filters: Optional[Any] = None
) -> List[T]:
    """
    Fetch multiple records by IDs in a single query.
    Prevents N+1 when processing multiple items.

    Args:
        session: SQLAlchemy session
        model: Model class
        id_list: List of IDs to fetch
        filters: Optional additional filter conditions

    Returns:
        List of model instances (order not guaranteed)
    """
    if not id_list:
        return []

    query = select(model).where(model.id.in_(id_list))
    if filters:
        query = query.where(filters)

    return list(session.execute(query).scalars().all())


def batch_fetch_related(
    session: Session,
    parent_ids: List[int],
    child_model: Type[T],
    foreign_key_col: Any,
    relationship_field: str,
) -> dict[int, List[T]]:
    """
    Batch fetch related child records and group by parent ID.

    Args:
        session: SQLAlchemy session
        parent_ids: List of parent IDs
        child_model: Child model class
        foreign_key_col: Foreign key column (e.g., Lesson.id)
        relationship_field: Name of relationship attribute on child

    Returns:
        Dictionary mapping parent_id -> list of children
    """
    if not parent_ids:
        return {}

    children = (
        session.execute(select(child_model).where(foreign_key_col.in_(parent_ids)))
        .scalars()
        .all()
    )

    grouped = {}
    for child in children:
        parent_id = getattr(child, relationship_field)
        if parent_id not in grouped:
            grouped[parent_id] = []
        grouped[parent_id].append(child)

    return grouped
