"""subscription_unique_org

Item #23: handle_stripe_webhook's _handle_checkout_completed does a
check-then-insert (get_subscription() then create if not found) with no
DB-level guard, so two checkout.session.completed webhooks racing for the
same org (e.g. a retried delivery overlapping the original) could both
pass the check before either commits, creating two Subscription rows for
the same (industry_id, organisation_id). Adds the missing unique
constraint; the webhook handler now catches the resulting IntegrityError
and treats it as the other writer having already won.

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_subscription_industry_org',
        'subscriptions',
        ['industry_id', 'organisation_id'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_subscription_industry_org', 'subscriptions', type_='unique'
    )
