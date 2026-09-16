"""
AUSTRAC Regulatory Reporting API.

Covers TTR, SMR reports and the immutable Filing Register.

IFTI-DRA reporting moved to app/api/routes/ifti.py (see PARKING_LOT.md P28):
that file's IFTIRecord model is the one with an AUSTRAC-template-accurate
Excel export (generate_ifti_excel()), matching this app's actual IFTI
workflow -- fill the official spreadsheet, lodge it via AUSTRAC Online.
This file's own IFTI section had maker-checker/audit but no export
capability at all, so was retired in favour of porting that workflow onto
ifti.py instead. The IFTIReport model/table is left in place (unused by
new writes) since app/models/ifti_receipt.py's IFTIReceipt still carries an
optional FK to it for historical/receipt-linkage rows.

Role permissions:
  - analyst+      : read reports, generate drafts from transactions/cases
  - compliance+   : update drafts, move to review
  - mlro+         : approve, submit, acknowledge, reject
  - Maker-checker : reviewer ≠ approver enforced on all regulatory reports

Every draft/review/approve/sign-off/submit/acknowledge/reject/redraft action
on every report type is written to the audit trail (_log(), entity_type
ttr_report/smr_report) -- queryable via GET /audit/. Previously only
"submit" was audited; see docs/regulatory-reporting.md.

TTR and SMR both have a /reject endpoint -- their redraft endpoints guard
on status == rejected, but nothing could ever set that status before this
fix.

DISCLAIMER: This API provides compliance workflow tooling only.
All decisions to lodge reports with AUSTRAC remain with the reporting entity.

This package was split out of a single 1497-line reports.py; see
_shared.py, summary.py, ttr.py, smr.py, filing_register.py and ecdd.py.
filing_register.py also fixes a real route-shadowing bug found during the
split -- see that module's docstring and PARKING_LOT.md.
"""

from fastapi import APIRouter

from . import ecdd, filing_register, smr, summary, ttr

router = APIRouter(prefix="/reports", tags=["Regulatory Reports"])

router.include_router(summary.router)
router.include_router(ttr.router)
router.include_router(smr.router)
router.include_router(filing_register.router)
router.include_router(ecdd.router)
