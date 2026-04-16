"""
Centralized authentication & authorization dependencies.

Usage in routers:
    from core.security import get_current_user, require_role

    # Protect an entire router
    router = APIRouter(dependencies=[Depends(get_current_user)])

    # Require specific role on a single route
    router.add_api_route("/admin-only", handler, dependencies=[Depends(require_role("admin"))])
"""

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from typing import Optional

from core.config import settings
from database import get_db
from exceptions import UnauthorizedError, ForbiddenError
from models import User

# Accepts token from:
#   1) Authorization: Bearer <token> header (standard OAuth2)
#   2) ?token=<token> query param (legacy FE support)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate the JWT token, return the authenticated User.

    Requires Bearer header token.
    """
    if not token:
        raise UnauthorizedError("Authentication required")

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise UnauthorizedError("Invalid or expired token")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedError("Invalid token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise UnauthorizedError("User not found")

    return user


def require_role(*roles: str):
    """Dependency factory that checks the current user has one of the required roles.

    Usage:
        dependencies=[Depends(require_role("admin", "coach"))]
    """

    def _guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise ForbiddenError(
                f"Access denied. Required role: {', '.join(roles)}"
            )
        return current_user

    return _guard
