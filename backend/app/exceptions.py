class SessionNotFoundError(Exception):
    """Raised when a session does not exist or does not belong to the requesting user."""


class RepositoryError(Exception):
    """Raised when a Firestore operation fails at the infrastructure level."""


class ChatStreamError(Exception):
    """Raised when the LangGraph / LLM streaming pipeline fails."""
