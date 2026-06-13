"""
Application configuration, loaded once from environment / .env at startup.

All other modules must import `settings` from here instead of calling
os.environ / os.getenv directly.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Firebase
    firebase_service_account_path: str = "./serviceAccountKey.json"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"  # swap for OpenRouter later

    # Memory (Chroma + OpenAI embeddings)
    chroma_persist_directory: str = "./chroma_db"
    memory_collection_prefix: str = "memory"
    max_memories_injected: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
