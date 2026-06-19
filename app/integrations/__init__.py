"""
Verigo integration layer.

Each integration module exposes a get_provider() factory that returns
the configured concrete implementation. Swap providers by setting env vars —
no code changes required.

Usage:
    from app.integrations import sanctions, pep, email, sms, abr, asic, ocr, austrac

    result = await sanctions.get_provider().screen(name="John Smith")
    result = await pep.get_provider().screen(name="John Smith", country="AU")
    ok = await email.get_provider().send(EmailMessage(to=[...], subject=..., html=...))
    record = await abr.get_provider().lookup_abn("51 824 753 556")
"""

from app.integrations import abr, asic, austrac, email, ocr, pep, sanctions, sms

__all__ = ["austrac", "asic", "abr", "sanctions", "pep", "ocr", "email", "sms"]
