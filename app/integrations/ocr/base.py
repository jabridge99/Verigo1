"""Abstract interface for document OCR / ID extraction."""
from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any


@dataclass
class DocumentExtraction:
    document_type: str            # passport, drivers_licence, national_id, etc.
    full_name: str | None = None
    date_of_birth: str | None = None   # ISO date string
    id_number: str | None = None
    expiry_date: str | None = None
    issuing_country: str | None = None
    nationality: str | None = None
    address: str | None = None
    confidence: float = 0.0       # 0.0–1.0
    raw: Any = None


class OCRProvider(abc.ABC):

    @abc.abstractmethod
    async def extract(
        self,
        image_bytes: bytes,
        document_type: str = "auto",   # auto | passport | drivers_licence | national_id
        mime_type: str = "image/jpeg",
    ) -> DocumentExtraction:
        """Extract structured data from a document image."""
