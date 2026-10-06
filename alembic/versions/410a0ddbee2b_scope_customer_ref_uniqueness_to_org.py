"""scope_customer_ref_uniqueness_to_org

customers.customer_ref carried a global unique index, but
_next_customer_ref() (app/api/routes/customers.py) generates it per-org --
counting only that org's existing customers -- so it was never actually
globally unique in intent: two different orgs onboarding their Nth
customer of the same calendar year always generate the identical ref
(e.g. both orgs' first customer ever both get "KYC-2026-00001"). A global
unique index rejects the second org's insert outright, breaking customer
onboarding for every organisation after the first to reach a given
per-org sequence number in a given year. Found via P10's new
cross-industry risk-weight tests, which create customers in two different
orgs in the same test and hit this collision immediately.

Fixed by scoping the uniqueness to (org_id, customer_ref), matching the
generator's real per-org intent.

Note: the existing uniqueness is enforced by a plain unique INDEX
(SQLAlchemy's Column(unique=True, index=True) naming convention gives
"ix_customers_customer_ref", not a named table CONSTRAINT) -- confirmed
by actually running this migration against a real Postgres database
seeded via the baseline create_all() migration, not assumed from the
model declaration alone.

Revision ID: 410a0ddbee2b
Revises: a3f5c8d1e9b2
Create Date: 2026-09-15 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "410a0ddbee2b"
down_revision: Union[str, None] = "a3f5c8d1e9b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_unique = {
        uc["name"] for uc in inspector.get_unique_constraints("customers")
    }
    if "uq_customer_org_ref" in existing_unique:
        # Already created by Base.metadata.create_all() -- this repo's own
        # baseline_sync_with_models migration applied to a genuinely fresh
        # database builds every table from the current model state
        # (composite constraint included) rather than replaying history.
        return

    existing_indexes = {ix["name"] for ix in inspector.get_indexes("customers")}
    if "ix_customers_customer_ref" in existing_indexes:
        op.drop_index("ix_customers_customer_ref", table_name="customers")

    op.create_index("ix_customers_customer_ref", "customers", ["customer_ref"])
    op.create_unique_constraint(
        "uq_customer_org_ref", "customers", ["org_id", "customer_ref"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_customer_org_ref", "customers", type_="unique")
    op.drop_index("ix_customers_customer_ref", table_name="customers")
    op.create_index(
        "ix_customers_customer_ref", "customers", ["customer_ref"], unique=True
    )
