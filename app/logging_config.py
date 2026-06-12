"""
Structured logging configuration.
JSON format in production; coloured text in development.
"""

import logging
import logging.config

from app.config import settings


def setup_logging() -> None:
    log_level = settings.log_level.upper()

    if settings.is_production:
        # JSON structured logging (works with Datadog, CloudWatch, GCP Logging etc.)
        fmt = "%(asctime)s %(levelname)s %(name)s %(message)s"
    else:
        # Human-readable in development
        fmt = "%(asctime)s \033[36m%(name)s\033[0m %(levelname)s  %(message)s"

    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": fmt,
                "datefmt": "%Y-%m-%dT%H:%M:%S",
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "formatter": "default",
            }
        },
        "root": {
            "level": log_level,
            "handlers": ["console"],
        },
        "loggers": {
            "uvicorn": {"level": "INFO", "propagate": True},
            "uvicorn.access": {"level": "WARNING", "propagate": True},  # handled by our middleware
            "sqlalchemy.engine": {"level": "WARNING", "propagate": True},
            "tvg": {"level": log_level, "propagate": True},
        },
    }

    logging.config.dictConfig(config)

    if settings.sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

            sentry_sdk.init(
                dsn=settings.sentry_dsn,
                environment=settings.environment,
                release=f"tvg@{settings.version}",
                integrations=[FastApiIntegration(), SqlalchemyIntegration()],
                traces_sample_rate=0.1,
            )
            logging.getLogger("tvg").info("Sentry initialised")
        except ImportError:
            logging.warning("sentry_sdk not installed — skipping Sentry init")
