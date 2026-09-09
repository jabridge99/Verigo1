"""policy_type_independent_review

P7/P11: seed_aml_solution() (app/templates/aml/factory.py) previously created
rows in the legacy, UI-disconnected Control/AMLPolicy models
(app.models.aml_solution) instead of the actively-developed GovernanceControl/
Policy models behind GET/POST /governance/controls and /governance/policies
-- freshly seeded starter controls/policies were invisible to the real UI.
Retargeting seeding at the governance module needs a policy_type value for
the "Independent Review Policy" BASE_POLICIES entry, which Policy.policy_type
(a closed PolicyType enum) had no equivalent for.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f7
Create Date: 2026-09-09
"""

from typing import Sequence, Union

from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TYPE policytype ADD VALUE IF NOT EXISTS 'independent_review_policy'"
        )


def downgrade() -> None:
    # Postgres cannot drop enum values without recreating the type; left as
    # a no-op, consistent with other enum-value migrations here.
    pass
