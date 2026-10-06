from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SalesIA Enterprise API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "development-only-change-me"
    access_token_expire_minutes: int = 480
    database_url: str = "sqlite:///./salesia-dev.sqlite3"
    cors_origins: str = "http://localhost:5173"
    trusted_proxy_hosts: str = "127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
    supabase_url: str = ""
    supabase_jwks_url: str = ""
    supabase_jwt_audience: str = "authenticated"
    company_name: str = "SalesIA Enterprise"
    admin_dni: str = ""
    admin_password: str = ""
    tax_rate: float = 0.18
    upload_dir: str = "uploads"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url.strip() and self.supabase_jwks_url.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
