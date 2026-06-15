"""Abstract interface for ASIC company lookups."""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CompanyRecord:
    acn: str
    name: str
    status: str               # Registered, Deregistered, etc.
    company_type: str         # Proprietary, Public, etc.
    registered_date: str | None = None
    deregistered_date: str | None = None
    abn: str | None = None
    registered_address: str | None = None
    principal_place: str | None = None
    directors: list[dict] = field(default_factory=list)   # [{name, dob, role}]
    raw: Any = None


class ASICProvider(abc.ABC):

    @abc.abstractmethod
    async def lookup_company(self, acn: str) -> CompanyRecord | None:
        """Look up a company by ACN."""

    @abc.abstractmethod
    async def search_companies(self, name: str) -> list[CompanyRecord]:
        """Search companies by name."""

    @abc.abstractmethod
    async def get_directors(self, acn: str) -> list[dict]:
        """Return current directors/officeholders for an ACN."""
