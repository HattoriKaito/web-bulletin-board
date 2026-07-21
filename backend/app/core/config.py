from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ランタイム接続（app_user、NOBYPASSRLS）
    db_user: str = "app_user"
    db_password: str = ""
    db_host: str = ""
    db_port: int = 5432
    db_name: str = "postgres"

    # マイグレーション専用接続（DDL権限を持つロール）
    migration_db_user: str = "postgres"
    migration_db_password: str = ""
    migration_db_host: str = ""
    migration_db_port: int = 5432
    migration_db_name: str = "postgres"

    jwt_secret: str = "change-me-to-a-long-random-value"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    frontend_origin: str = "http://localhost:5173"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def migration_database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.migration_db_user}:{self.migration_db_password}"
            f"@{self.migration_db_host}:{self.migration_db_port}/{self.migration_db_name}"
        )


settings = Settings()
