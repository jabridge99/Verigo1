"""
AML program retention — version-history access policy for lapsed/canceled
organisations.

Active subscribers see full AML program version history. Once a
subscription lapses, history narrows to the latest version only; retrieving
an older version becomes a deliberately slow, capped, admin-visible process
(not a self-service download) — both to satisfy AUSTRAC's 7-year
record-keeping obligation on the customer's behalf, and to give the
business a natural win-back touchpoint instead of letting a churned
customer walk away with everything instantly.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.aml_program import AMLProgram, AMLProgramVersion, VersionRetrievalRequest
from app.models.organisation import Organisation
from app.services import aml_program_service, email_service

RETRIEVAL_COOLDOWN_HOURS = 8
MAX_LIFETIME_RETRIEVALS = 3


def _history(db: Session, org: Organisation) -> list[VersionRetrievalRequest]:
    return (
        db.query(VersionRetrievalRequest)
        .filter(VersionRetrievalRequest.organisation_id == org.id)
        .order_by(VersionRetrievalRequest.requested_at.desc())
        .all()
    )


def request_old_version(
    db: Session,
    org: Organisation,
    program: AMLProgram,
    version: int,
    requested_by: str,
) -> AMLProgramVersion:
    """Retrieve an archived (non-latest) version for a lapsed organisation.
    Throttled to one retrieval per RETRIEVAL_COOLDOWN_HOURS, capped at
    MAX_LIFETIME_RETRIEVALS — beyond that the customer must buy a full
    notarized export. Every request alerts the admin for follow-up."""
    target = aml_program_service.get_version(db, program, version)
    if not target:
        raise ValueError("Version not found")

    if version != program.version:
        history = _history(db, org)
        if len(history) >= MAX_LIFETIME_RETRIEVALS:
            raise PermissionError(
                f"Retrieval limit reached ({MAX_LIFETIME_RETRIEVALS} versions). "
                "Purchase a full notarized export to access your complete history."
            )
        if history:
            last_requested_at = history[0].requested_at.replace(tzinfo=timezone.utc)
            elapsed = datetime.now(timezone.utc) - last_requested_at
            cooldown = timedelta(hours=RETRIEVAL_COOLDOWN_HOURS)
            if elapsed < cooldown:
                retry_at = last_requested_at + cooldown
                raise PermissionError(
                    f"Please wait until {retry_at.isoformat()} before requesting another version."
                )

    db.add(
        VersionRetrievalRequest(
            organisation_id=org.id,
            version=version,
            requested_by=requested_by,
        )
    )
    db.commit()

    if settings.master_admin_email:
        email_service.send_admin_retention_alert(
            settings.master_admin_email, org.name, org.org_id, version, requested_by
        )

    return target


def latest_only(versions: list[AMLProgramVersion]) -> list[AMLProgramVersion]:
    """Narrow a full version list down to just the latest — what a lapsed
    organisation sees by default."""
    return versions[:1] if versions else []
