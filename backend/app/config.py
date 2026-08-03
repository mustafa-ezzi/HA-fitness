from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "HA Fitness"
    database_url: str = "sqlite:///./ha_gym.db"
    secret_key: str = "ha-gym-dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    # Comma-separated exact frontend origins, e.g. https://ha-fitness.up.railway.app
    cors_origins: str = ""
    # Matches local Vite and Railway frontend URLs by default
    cors_origin_regex: str = (
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
        r"|https://[\w\-.]+\.up\.railway\.app"
    )


settings = Settings()
