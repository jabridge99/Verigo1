"""
Customer & KYC/KYB API — bank-grade onboarding for individuals and businesses.

Architecture:
  - Single Customer master record (individual / sole_trader / company / trust / partnership)
  - Separate child tables for each verification type (identity doc, selfie, address, phone, email)
  - Unified ScreeningRecord table; pluggable provider via screening_type + provider fields
  - Onboarding checklist tracks completion of each CDD step
  - Immutable risk score history; risk fields never user-settable

AUSTRAC requirements:
  - CDD Level (standard / simplified / enhanced) set by engine or compliance
  - Mandatory PEP/sanctions screening before status → active
  - EDD approval gate (senior_managing_official sign-off)
  - Ongoing monitoring: next_review_date enforced by review records

This package was split out of a single 2377-line customers.py; see
_shared.py, crud.py, kyc_identity.py, kyb_business.py,
contact_verification.py, customer_screening.py, compliance_status.py,
reviews_notes.py, workspace.py, override.py and bulk_import.py.

The prefix is applied per include_router() call rather than on this
package's own APIRouter(): crud.py's list_customers/create_customer are
GET ""/POST "" (the bare /customers path), and FastAPI's include_router()
rejects an empty combined prefix + empty route path outright (it can't see
that this router's own prefix will fill the gap) -- passing
prefix="/customers" explicitly on every call sidesteps that check while
resolving to the exact same final paths. (Same fix as the screening.py
split; see that package's __init__.py for the full explanation.)

Unlike the screening.py split, there is no cross-file route-registration-
order hazard here: crud.py's only path-parameter route at the top level,
GET /{customer_id}, is a single path segment, and every route in every
other file in this package is at least two segments
(/{customer_id}/<literal>) or a two-segment literal (/import/<literal>),
so none of them can be shadowed by /{customer_id} regardless of
inclusion order.
"""

from fastapi import APIRouter

from . import (
    bulk_import,
    compliance_status,
    contact_verification,
    crud,
    customer_screening,
    kyb_business,
    kyc_identity,
    override,
    reviews_notes,
    workspace,
)

router = APIRouter(tags=["Customers"])

router.include_router(crud.router, prefix="/customers")
router.include_router(kyc_identity.router, prefix="/customers")
router.include_router(kyb_business.router, prefix="/customers")
router.include_router(contact_verification.router, prefix="/customers")
router.include_router(customer_screening.router, prefix="/customers")
router.include_router(compliance_status.router, prefix="/customers")
router.include_router(reviews_notes.router, prefix="/customers")
router.include_router(workspace.router, prefix="/customers")
router.include_router(override.router, prefix="/customers")
router.include_router(bulk_import.router, prefix="/customers")
