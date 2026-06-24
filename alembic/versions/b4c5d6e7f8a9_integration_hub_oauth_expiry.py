"""integration_hub_oauth_expiry

Integrations Hub gap-closing (additive, no new tables): adds OAuth2 token
storage and credential-expiry tracking to OrgIntegration so the existing
Integration Hub framework (IntegrationProvider/OrgIntegration) can support
OAuth-based providers and expiry alerting without a second connector
framework. Also links ComplianceCalendarItem to org_integrations.

Revision ID: b4c5d6e7f8a9
Revises: e5f6a7b8c9d0
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'org_integrations', sa.Column('credential_expires_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'org_integrations', sa.Column('oauth_state', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'org_integrations', sa.Column('oauth_access_token_encrypted', sa.Text(), nullable=True)
    )
    op.add_column(
        'org_integrations', sa.Column('oauth_refresh_token_encrypted', sa.Text(), nullable=True)
    )
    op.add_column(
        'org_integrations', sa.Column('oauth_expires_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'compliance_calendar', sa.Column('integration_id', sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('compliance_calendar', 'integration_id')
    op.drop_column('org_integrations', 'oauth_expires_at')
    op.drop_column('org_integrations', 'oauth_refresh_token_encrypted')
    op.drop_column('org_integrations', 'oauth_access_token_encrypted')
    op.drop_column('org_integrations', 'oauth_state')
    op.drop_column('org_integrations', 'credential_expires_at')
