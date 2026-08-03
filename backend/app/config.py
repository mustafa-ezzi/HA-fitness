from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "HA Fitness"
    database_url: str = "sqlite:///./ha_gym.db"
    secret_key: str = "ha-gym-dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    cors_origin_regex: str = r"http://(localhost|127\.0\.0\.1):\d+"


settings = Settings()
