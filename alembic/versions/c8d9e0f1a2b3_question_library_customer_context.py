"""question_library_customer_context

Phase 3: generalize the existing OrgApprovalQuestion checklist (previously
transaction-only) to also cover the customer/onboarding approval workflow,
instead of introducing a parallel QuestionLibrary table.

- Adds `context` enum column to org_approval_questions (transaction|customer).
- Adds the customer_question_responses table, mirroring
  transaction_question_responses, keyed to customer_id.
- Seeds the brief's top-10 transaction and top-10 customer checklist
  questions as system (org_id=null... not applicable here, org_approval_questions
  has no nullable org_id) -- seeding is left to org onboarding defaults via
  the API, since org_approval_questions.org_id is NOT NULL (per-org config,
  not a shared system catalogue). No seed rows are inserted by this migration.

Revision ID: c8d9e0f1a2b3
Revises: b3c4d5e6f7a8
Create Date: 2026-06-24 00:20:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


question_context_enum = sa.Enum('transaction', 'customer', name='questioncontext')
# `questionanswer` already exists in the DB (created by an earlier migration
# for transaction_question_responses.answer). Passing create_type=False on an
# inline sa.Enum() inside op.create_table() does NOT suppress Alembic's
# emitted CREATE TYPE for that type — PostgresSQL's ENUM._on_table_create()
# only skips creation if checkfirst is honoured, which create_type=False does
# not request. Explicitly create with checkfirst=True instead, exactly like
# question_context_enum below.
question_answer_enum = sa.Enum(
    'yes', 'no', 'not_applicable', name='questionanswer', create_type=False
)


def upgrade() -> None:
    question_context_enum.create(op.get_bind(), checkfirst=True)
    question_answer_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        'org_approval_questions',
        sa.Column(
            'context',
            question_context_enum,
            nullable=False,
            server_default='transaction',
        ),
    )
    op.create_index(
        'ix_org_approval_questions_context', 'org_approval_questions', ['context']
    )

    op.create_table(
        'customer_question_responses',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column(
            'customer_id',
            sa.String(),
            sa.ForeignKey('customers.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'question_id',
            sa.String(),
            sa.ForeignKey('org_approval_questions.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('org_id', sa.String(), nullable=False),
        sa.Column(
            'answer',
            question_answer_enum,
            nullable=False,
        ),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('answered_by', sa.String(), nullable=False),
        sa.Column('answered_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('customer_id', 'question_id', name='uq_customer_question'),
    )
    op.create_index(
        'ix_customer_question_responses_customer_id',
        'customer_question_responses',
        ['customer_id'],
    )
    op.create_index(
        'ix_customer_question_responses_question_id',
        'customer_question_responses',
        ['question_id'],
    )
    op.create_index(
        'ix_customer_question_responses_org_id',
        'customer_question_responses',
        ['org_id'],
    )


def downgrade() -> None:
    op.drop_index(
        'ix_customer_question_responses_org_id', table_name='customer_question_responses'
    )
    op.drop_index(
        'ix_customer_question_responses_question_id', table_name='customer_question_responses'
    )
    op.drop_index(
        'ix_customer_question_responses_customer_id', table_name='customer_question_responses'
    )
    op.drop_table('customer_question_responses')

    op.drop_index('ix_org_approval_questions_context', table_name='org_approval_questions')
    op.drop_column('org_approval_questions', 'context')
    question_context_enum.drop(op.get_bind(), checkfirst=True)
