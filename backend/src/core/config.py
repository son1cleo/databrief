from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://databrief:databrief@db:5432/databrief"
    redis_url: str = "redis://redis:6379/0"

    nextauth_secret: str = "dev-secret-change-me"

    anthropic_api_key: str = ""

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_starter_price_id: str = ""
    stripe_growth_price_id: str = ""
    stripe_business_price_id: str = ""

    upload_dir: str = "/app/uploads"
    max_file_size_mb: int = 50

    frontend_url: str = "http://localhost:3000"


settings = Settings()
