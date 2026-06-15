from __future__ import annotations

from app.config import settings
from .base import OCRProvider


def get_provider() -> OCRProvider:
    provider = getattr(settings, "ocr_provider", "stub")

    if provider == "textract":
        from .aws_textract import AWSTextractProvider
        return AWSTextractProvider(region=getattr(settings, "s3_region", "ap-southeast-2"))

    if provider == "google_vision":
        raise NotImplementedError("Google Vision OCR provider not yet implemented")

    from .stub import StubOCRProvider
    return StubOCRProvider()
