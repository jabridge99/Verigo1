from __future__ import annotations

import logging
from .base import OCRProvider, DocumentExtraction

log = logging.getLogger("verigo.integrations.ocr")


class StubOCRProvider(OCRProvider):
    async def extract(self, image_bytes: bytes, document_type: str = "auto",
                      mime_type: str = "image/jpeg") -> DocumentExtraction:
        log.info("OCR stub: extract called (size=%d bytes)", len(image_bytes))
        return DocumentExtraction(document_type=document_type, confidence=0.0)
