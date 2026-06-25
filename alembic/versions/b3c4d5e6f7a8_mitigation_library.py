"""mitigation_library

Mitigation Library (Phase 2): a reusable mitigation catalogue, distinct from
RiskMitigation (per-assessment-run instance data). Adds the new
mitigation_library_items table plus optional library_item_id link columns on
risk_mitigations and governance_controls. No existing tables renamed or
removed.

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-06-24 00:10:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mitigation_library_items',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organisations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('control_weighting', sa.Float(), nullable=True),
        sa.Column('effectiveness_rating', sa.String(length=30), nullable=True),
        sa.Column('applicable_industries', sa.JSON(), nullable=True),
        sa.Column('risk_categories', sa.JSON(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        'ix_mitigation_library_items_org_id', 'mitigation_library_items', ['org_id']
    )

    op.add_column(
        'risk_mitigations',
        sa.Column('library_item_id', sa.String(), nullable=True),
    )
    op.create_index(
        'ix_risk_mitigations_library_item_id', 'risk_mitigations', ['library_item_id']
    )
    op.create_foreign_key(
        'fk_risk_mitigations_library_item_id',
        'risk_mitigations',
        'mitigation_library_items',
        ['library_item_id'],
        ['id'],
    )

    op.add_column(
        'governance_controls',
        sa.Column('library_item_id', sa.String(), nullable=True),
    )
    op.create_index(
        'ix_governance_controls_library_item_id', 'governance_controls', ['library_item_id']
    )
    op.create_foreign_key(
        'fk_governance_controls_library_item_id',
        'governance_controls',
        'mitigation_library_items',
        ['library_item_id'],
        ['id'],
    )

    _seed_default_items()


def _seed_default_items() -> None:
    """System-seeded (org_id=null) starter catalogue from the AML/CTF brief examples."""
    import uuid

    table = sa.table(
        'mitigation_library_items',
        sa.column('id', sa.String),
        sa.column('org_id', sa.String),
        sa.column('name', sa.String),
        sa.column('description', sa.Text),
        sa.column('category', sa.String),
        sa.column('control_weighting', sa.Float),
        sa.column('effectiveness_rating', sa.String),
        sa.column('applicable_industries', sa.JSON),
        sa.column('risk_categories', sa.JSON),
        sa.column('is_system', sa.Boolean),
        sa.column('is_active', sa.Boolean),
    )
    defaults = [
        ("Manual Document Review", "document_review", 0.15, "cdd"),
        ("Face-to-Face Meeting", "identity_verification", 0.20, "cdd"),
        ("Independent Verification", "identity_verification", 0.25, "cdd"),
        ("PEP Screening", "screening", 0.20, "pep_screening"),
        ("Sanctions Screening", "screening", 0.25, "sanctions_screening"),
        ("Adverse Media Search", "screening", 0.10, "edd"),
        ("Address Verification", "identity_verification", 0.10, "cdd"),
        ("Company Search", "beneficial_ownership", 0.15, "beneficial_ownership"),
        ("Beneficial Ownership Verification", "beneficial_ownership", 0.25, "beneficial_ownership"),
        ("Source of Funds Review", "source_of_funds", 0.20, "edd"),
        ("Source of Wealth Review", "source_of_wealth", 0.20, "edd"),
        ("Enhanced Due Diligence", "enhanced_due_diligence", 0.30, "edd"),
        ("Management Approval", "governance_approval", 0.15, "governance"),
        ("Ongoing Monitoring", "ongoing_monitoring", 0.20, "transaction_monitoring"),
    ]
    op.bulk_insert(
        table,
        [
            {
                "id": f"mli_{uuid.uuid4().hex[:12]}",
                "org_id": None,
                "name": name,
                "description": None,
                "category": category,
                "control_weighting": weight,
                "effectiveness_rating": "not_tested",
                "applicable_industries": [],
                "risk_categories": [risk_area],
                "is_system": True,
                "is_active": True,
            }
            for name, category, weight, risk_area in defaults
        ],
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_governance_controls_library_item_id', 'governance_controls', type_='foreignkey'
    )
    op.drop_index('ix_governance_controls_library_item_id', table_name='governance_controls')
    op.drop_column('governance_controls', 'library_item_id')

    op.drop_constraint(
        'fk_risk_mitigations_library_item_id', 'risk_mitigations', type_='foreignkey'
    )
    op.drop_index('ix_risk_mitigations_library_item_id', table_name='risk_mitigations')
    op.drop_column('risk_mitigations', 'library_item_id')

    op.drop_index('ix_mitigation_library_items_org_id', table_name='mitigation_library_items')
    op.drop_table('mitigation_library_items')
