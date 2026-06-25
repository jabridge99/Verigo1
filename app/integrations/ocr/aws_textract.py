"""
AWS Textract OCR provider for ID document extraction.
Requires: pip install boto3
Set OCR_PROVIDER=textract and AWS credentials in environment.
"""

from __future__ import annotations

import logging

from .base import DocumentExtraction, OCRProvider

log = logging.getLogger("verigo.integrations.ocr.textract")


class AWSTextractProvider(OCRProvider):
    def __init__(self, region: str = "ap-southeast-2"):
        self.region = region
        self._client = None

    def _get_client(self):
        if self._client is None:
            import boto3

            self._client = boto3.client("textract", region_name=self.region)
        return self._client

    async def extract(
        self,
        image_bytes: bytes,
        document_type: str = "auto",
        mime_type: str = "image/jpeg",
    ) -> DocumentExtraction:
        import asyncio

        client = self._get_client()

        def _call():
            return client.analyze_id(DocumentPages=[{"Bytes": image_bytes}])

        resp = await asyncio.get_event_loop().run_in_executor(None, _call)

        fields: dict = {}
        for doc in resp.get("IdentityDocuments", []):
            for field in doc.get("IdentityDocumentFields", []):
                key = field.get("Type", {}).get("Text", "")
                val = field.get("ValueDetection", {}).get("Text", "")
                conf = field.get("ValueDetection", {}).get("Confidence", 0) / 100
                if val:
                    fields[key] = (val, conf)

        def f(key: str):
            return fields.get(key, (None, 0.0))[0]

        avg_confidence = (
            sum(v[1] for v in fields.values()) / len(fields) if fields else 0.0
        )

        return DocumentExtraction(
            document_type=document_type,
            full_name=f("FIRST_NAME")
            and f"{f('FIRST_NAME')} {f('LAST_NAME') or ''}".strip(),
            date_of_birth=f("DATE_OF_BIRTH"),
            id_number=f("DOCUMENT_NUMBER"),
            expiry_date=f("EXPIRATION_DATE"),
            issuing_country=f("PLACE_OF_ISSUE"),
            nationality=f("MRZ_CODE"),
            confidence=round(avg_confidence, 3),
            raw=resp,
        )
