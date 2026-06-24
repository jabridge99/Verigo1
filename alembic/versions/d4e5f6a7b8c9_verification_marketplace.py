"""verification_marketplace

Phase 4: Verification Marketplace — a generic, provider-agnostic catalogue
(VerificationProvider) and ordering layer (VerificationOrder) for
identity/business/sanctions/adverse-media checks. Supports manual, api, and
hybrid integration modes so manual-only orgs are fully supported (not
hardcoded to any single vendor). Billable orders create a UsageRecord on
completion (no new billing model).

Revision ID: d4e5f6a7b8c9
Revises: c8d9e0f1a2b3
Create Date: 2026-06-24 00:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'verification_providers',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organisations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column(
            'check_type',
            sa.Enum(
                'identity_verification', 'business_verification', 'address_verification',
                'sanctions_screening', 'pep_screening', 'adverse_media',
                'crypto_wallet_screening', 'source_of_funds', 'other',
                name='verificationchecktype',
            ),
            nullable=False,
        ),
        sa.Column(
            'integration_mode',
            sa.Enum('api', 'manual', 'hybrid', name='verificationintegrationmode'),
            nullable=False,
        ),
        sa.Column('vendor_key', sa.String(length=50), nullable=True),
        sa.Column('unit_cost_aud', sa.Float(), nullable=False),
        sa.Column('markup_pct', sa.Float(), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_verification_providers_org_id', 'verification_providers', ['org_id'])
    op.create_index('ix_verification_providers_check_type', 'verification_providers', ['check_type'])
    op.create_index('ix_verification_providers_is_active', 'verification_providers', ['is_active'])

    op.create_table(
        'verification_orders',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organisations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider_id', sa.String(), sa.ForeignKey('verification_providers.id'), nullable=False),
        sa.Column('entity_type', sa.String(length=30), nullable=False),
        sa.Column('entity_id', sa.String(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'in_progress', 'completed', 'rejected', 'cancelled', name='verificationorderstatus'),
            nullable=False,
        ),
        sa.Column('screening_record_id', sa.String(), sa.ForeignKey('screening_records.id'), nullable=True),
        sa.Column('evidence_url', sa.String(length=500), nullable=True),
        sa.Column('result_summary', sa.JSON(), nullable=True),
        sa.Column('usage_record_id', sa.String(), sa.ForeignKey('usage_records.id'), nullable=True),
        sa.Column('requested_by', sa.String(), nullable=False),
        sa.Column('reviewed_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_verification_orders_org_id', 'verification_orders', ['org_id'])
    op.create_index('ix_verification_orders_provider_id', 'verification_orders', ['provider_id'])
    op.create_index('ix_verification_orders_entity_type', 'verification_orders', ['entity_type'])
    op.create_index('ix_verification_orders_entity_id', 'verification_orders', ['entity_id'])
    op.create_index('ix_verification_orders_status', 'verification_orders', ['status'])
    op.create_index('ix_verification_orders_usage_record_id', 'verification_orders', ['usage_record_id'])
    op.create_index('ix_verification_orders_created_at', 'verification_orders', ['created_at'])

    _seed_default_providers()


def _seed_default_providers() -> None:
    """System-seeded (org_id=null) starter catalogue: manual-review providers
    requiring no third-party API, plus placeholder api/hybrid entries orgs
    can configure with their own vendor_key/cost."""
    import uuid

    table = sa.table(
        'verification_providers',
        sa.column('id', sa.String),
        sa.column('org_id', sa.String),
        sa.column('name', sa.String),
        sa.column('check_type', sa.String),
        sa.column('integration_mode', sa.String),
        sa.column('vendor_key', sa.String),
        sa.column('unit_cost_aud', sa.Float),
        sa.column('markup_pct', sa.Float),
        sa.column('is_system', sa.Boolean),
        sa.column('is_active', sa.Boolean),
    )
    defaults = [
        ("Manual Identity Review", "identity_verification", "manual", None, 0.0),
        ("Manual Business Verification", "business_verification", "manual", None, 0.0),
        ("Manual Address Verification", "address_verification", "manual", None, 0.0),
        ("Manual Sanctions Screening Review", "sanctions_screening", "manual", None, 0.0),
        ("Manual Adverse Media Review", "adverse_media", "manual", None, 0.0),
        ("API Identity Verification (configure vendor)", "identity_verification", "api", None, 0.0),
        ("API Sanctions Screening (configure vendor)", "sanctions_screening", "api", None, 0.0),
        ("Hybrid Adverse Media Screening (configure vendor)", "adverse_media", "hybrid", None, 0.0),
    ]
    op.bulk_insert(
        table,
        [
            {
                "id": f"vprov_{uuid.uuid4().hex[:10]}",
                "org_id": None,
                "name": name,
                "check_type": check_type,
                "integration_mode": mode,
                "vendor_key": vendor_key,
                "unit_cost_aud": cost,
                "markup_pct": 0.0,
                "is_system": True,
                "is_active": True,
            }
            for name, check_type, mode, vendor_key, cost in defaults
        ],
    )


def downgrade() -> None:
    op.drop_index('ix_verification_orders_created_at', table_name='verification_orders')
    op.drop_index('ix_verification_orders_usage_record_id', table_name='verification_orders')
    op.drop_index('ix_verification_orders_status', table_name='verification_orders')
    op.drop_index('ix_verification_orders_entity_id', table_name='verification_orders')
    op.drop_index('ix_verification_orders_entity_type', table_name='verification_orders')
    op.drop_index('ix_verification_orders_provider_id', table_name='verification_orders')
    op.drop_index('ix_verification_orders_org_id', table_name='verification_orders')
    op.drop_table('verification_orders')

    op.drop_index('ix_verification_providers_is_active', table_name='verification_providers')
    op.drop_index('ix_verification_providers_check_type', table_name='verification_providers')
    op.drop_index('ix_verification_providers_org_id', table_name='verification_providers')
    op.drop_table('verification_providers')

    sa.Enum(name='verificationorderstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='verificationintegrationmode').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='verificationchecktype').drop(op.get_bind(), checkfirst=True)
