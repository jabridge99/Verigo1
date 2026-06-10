from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "KYC/AML Compliance System"
    debug: bool = False
    database_url: str = "sqlite:///./kyc_aml.db"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
