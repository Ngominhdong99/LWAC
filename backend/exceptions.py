class AppException(Exception):
    """Base application exception."""

    def __init__(self, message: str, detail: str | None = None):
        super().__init__(message)
        self.message = message
        self.detail = detail or message


class NotFoundError(AppException):
    """Resource not found (404)."""


class ConflictError(AppException):
    """Uniqueness or conflict violation (409)."""


class ValidationError(AppException):
    """Business validation error (400)."""


class UnauthorizedError(AppException):
    """Authentication failure (401)."""


class ForbiddenError(AppException):
    """Authorization failure – insufficient role/permissions (403)."""


class ServiceError(AppException):
    """Unexpected service error (500)."""
