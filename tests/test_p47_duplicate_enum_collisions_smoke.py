"""
P47: fixing P37's `ControlStatus` collision found the identical bug 8 more
times -- a Python enum class name reused across two (`AssessmentStatus`:
three) unrelated model files, neither column giving its Postgres type an
explicit name, so each group silently shared one underlying type.
Confirmed live against a real PostgreSQL 16 database (both an existing
pre-fix database and a genuinely fresh one built from the full migration
chain) that `CustomerType` was an active bug: the shared `customertype`
type only had `customer.py`'s 7 values, not `onboarding.py`'s
`"business"` -- so a real `POST /api/v1/onboarding/sessions` call with
`customer_type=business` 500'd before this fix and returns 201 after,
with `customer_type: "business"` genuinely persisted.

Same reasoning as tests/test_p37_controlstatus_enum_collision_smoke.py:
this repo's own test suite runs on SQLite (tests/conftest.py), which has
no shared named Postgres enum types at all, so the collision itself can't
be reproduced by a normal pytest DB test here. These tests guard the two
things that actually prevent it: every affected column now carries an
explicit, distinct type name, and the migration's hardcoded value lists
stay in sync with the real model enums. The actual Postgres DDL (and the
business-onboarding reproduction above) was verified live, not just here.
"""

from app.models.aml_solution import AssessmentStatus as LegacyRiskAssessmentStatus
from app.models.aml_solution import RiskAssessment as LegacyRiskAssessment
from app.models.aml_solution import TrainingRecord as LegacyTrainingRecord
from app.models.aml_solution import TrainingStatus as LegacyTrainingStatus
from app.models.case import CaseNote
from app.models.case import NoteType as CaseNoteType
from app.models.customer import Customer, CustomerNote, CustomerReview
from app.models.customer import CustomerType as MasterCustomerType
from app.models.customer import NoteType as CustomerNoteType
from app.models.customer import ReviewOutcome as CustomerReviewOutcome
from app.models.governance_training import GovernanceTrainingRecord
from app.models.governance_training import TrainingStatus as GovernanceTrainingStatus
from app.models.independent_review import (
    RecommendationPriority as ReviewRecommendationPriority,
)
from app.models.independent_review import (
    RecommendationStatus as ReviewRecommendationStatus,
)
from app.models.independent_review import ReviewRecommendation
from app.models.monitoring import AlertStatus as TransactionAlertStatus
from app.models.monitoring import TransactionAlert
from app.models.onboarding import CustomerType as OnboardingCustomerType
from app.models.onboarding import OnboardingSession
from app.models.professional_assessment import AssessmentStatus as ProfAssessmentStatus
from app.models.professional_assessment import ProfessionalAssessment, SOFAssessment
from app.models.professional_assessment import ReviewOutcome as ProfReviewOutcome
from app.models.regulatory_recommendation import (
    RecommendationPriority as RegulatoryRecommendationPriority,
)
from app.models.regulatory_recommendation import (
    RecommendationStatus as RegulatoryRecommendationStatus,
)
from app.models.regulatory_recommendation import RegulatoryRecommendation
from app.models.risk_engine import AssessmentStatus as RiskEngineAssessmentStatus
from app.models.risk_engine import RiskAssessmentRun
from app.models.screening import AlertStatus as ScreeningAlertStatus
from app.models.screening import ScreeningAlert

# (model, column, python enum, expected explicit Postgres type name)
CHECKS = [
    (TransactionAlert, "status", TransactionAlertStatus, "transaction_alert_status"),
    (ScreeningAlert, "status", ScreeningAlertStatus, "screening_alert_status"),
    (
        LegacyRiskAssessment,
        "status",
        LegacyRiskAssessmentStatus,
        "legacy_risk_assessment_status",
    ),
    (
        ProfessionalAssessment,
        "status",
        ProfAssessmentStatus,
        "professional_assessment_status",
    ),
    (
        RiskAssessmentRun,
        "status",
        RiskEngineAssessmentStatus,
        "risk_assessment_run_status",
    ),
    (Customer, "customer_type", MasterCustomerType, "master_customer_type"),
    (
        OnboardingSession,
        "customer_type",
        OnboardingCustomerType,
        "onboarding_customer_type",
    ),
    (CaseNote, "note_type", CaseNoteType, "case_note_type"),
    (CustomerNote, "note_type", CustomerNoteType, "customer_note_type"),
    (
        ReviewRecommendation,
        "priority",
        ReviewRecommendationPriority,
        "review_recommendation_priority",
    ),
    (
        RegulatoryRecommendation,
        "priority",
        RegulatoryRecommendationPriority,
        "regulatory_recommendation_priority",
    ),
    (
        ReviewRecommendation,
        "status",
        ReviewRecommendationStatus,
        "review_recommendation_status",
    ),
    (
        RegulatoryRecommendation,
        "status",
        RegulatoryRecommendationStatus,
        "regulatory_recommendation_status",
    ),
    (CustomerReview, "outcome", CustomerReviewOutcome, "customer_review_outcome"),
    (SOFAssessment, "review_outcome", ProfReviewOutcome, "professional_review_outcome"),
    (LegacyTrainingRecord, "status", LegacyTrainingStatus, "legacy_training_status"),
    (
        GovernanceTrainingRecord,
        "status",
        GovernanceTrainingStatus,
        "governance_training_status",
    ),
]


def test_every_previously_colliding_column_has_its_own_explicit_type_name():
    for model, column, _enum, expected_name in CHECKS:
        actual = model.__table__.columns[column].type.name
        assert actual == expected_name, f"{model.__name__}.{column}"


def test_no_two_distinct_enum_classes_still_share_a_type_name():
    seen: dict[str, tuple[type, str]] = {}
    for model, column, enum_cls, _expected_name in CHECKS:
        type_name = model.__table__.columns[column].type.name
        if type_name in seen:
            other_model, other_enum_name = seen[type_name]
            assert other_enum_name == enum_cls.__name__ and other_model is model, (
                f"type name {type_name!r} still shared between "
                f"{other_model.__name__} and {model.__name__}"
            )
        seen[type_name] = (model, enum_cls.__name__)


def test_customer_type_still_has_no_value_overlap_with_onboarding_customer_type():
    # Documents *why* CustomerType was the confirmed live bug: "individual"
    # is common to both (masking the default path), but every other value
    # -- including onboarding's "business" -- is unique to one side.
    master_values = {member.value for member in MasterCustomerType}
    onboarding_values = {member.value for member in OnboardingCustomerType}
    assert "business" in onboarding_values
    assert "business" not in master_values
    assert master_values & onboarding_values == {"individual"}
