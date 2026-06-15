import logging

from firebase_admin import firestore
from google.api_core.exceptions import GoogleAPICallError

from app.exceptions import RepositoryError

logger = logging.getLogger(__name__)

_DOC_ID = "default"


class CustomRulesRepository:
    def __init__(self) -> None:
        self._db = firestore.client()

    def _doc(self, user_id: str):
        return (
            self._db.collection("users")
            .document(user_id)
            .collection("custom_rules")
            .document(_DOC_ID)
        )

    def get(self, user_id: str) -> str | None:
        """Return the user's custom rules string, or None if not set."""
        try:
            snap = self._doc(user_id).get()
            if not snap.exists:
                return None
            return snap.get("rules") or None
        except GoogleAPICallError as exc:
            logger.error("Firestore error getting custom rules uid=%s: %s", user_id, exc)
            raise RepositoryError(f"Failed to get custom rules: {exc}") from exc

    def save(self, user_id: str, rules: str) -> None:
        """Upsert the user's custom rules string."""
        try:
            self._doc(user_id).set({"rules": rules, "user_id": user_id})
            logger.debug("Saved custom rules uid=%s", user_id)
        except GoogleAPICallError as exc:
            logger.error("Firestore error saving custom rules uid=%s: %s", user_id, exc)
            raise RepositoryError(f"Failed to save custom rules: {exc}") from exc
