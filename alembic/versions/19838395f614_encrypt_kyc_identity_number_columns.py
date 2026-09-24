"""encrypt_kyc_identity_number_columns

P51: Customer.tax_identification_number, BeneficialOwner.tax_identification_number
and BeneficialOwner.id_number were stored as plain text -- the only KYC
identity-number fields in the schema without application-level encryption
(connector/integration credentials already went through
app.services.crypto's Fernet layer). Now encrypted at rest via the ORM's
new EncryptedKycString column type (app/services/crypto.py), keyed off a
dedicated KYC_ENCRYPTION_KEY (falls back to SECRET_KEY if unset, same
dev-convenience pattern as STORAGE_ENCRYPTION_KEY).

Two steps, in order:
  1. Widen the three columns from VARCHAR(50) to VARCHAR(255) -- a
     Fernet-encrypted token (~165 chars incl. the "kyc:" prefix) doesn't
     fit in the old width.
  2. Re-encrypt every existing plaintext value in place. A schema change
     alone does not encrypt rows that already exist -- this is a real
     one-time data migration over live KYC identity numbers, not a
     reversible cosmetic tweak. Idempotent: skips any value that already
     carries the "kyc:" prefix, safe to re-run.

Revision ID: 19838395f614
Revises: 82cdd805f838
Create Date: 2026-09-15 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "19838395f614"
down_revision: Union[str, None] = "82cdd805f838"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = [
    ("customers", "tax_identification_number"),
    ("beneficial_owners", "tax_identification_number"),
    ("beneficial_owners", "id_number"),
]


def _encrypt_existing_plaintext_rows() -> None:
    # Imported here (not at module scope) so a plain `alembic history`/
    # `alembic heads` invocation never needs the app's settings/crypto
    # stack importable -- only running this migration's upgrade() does.
    from app.services.crypto import KYC_ENC_PREFIX, encrypt_kyc_field

    bind = op.get_bind()
    for table, column in _COLUMNS:
        rows = bind.execute(
            sa.text(
                f"SELECT id, {column} FROM {table} "
                f"WHERE {column} IS NOT NULL AND {column} != ''"
            )
        ).fetchall()
        for row_id, plain_value in rows:
            if plain_value.startswith(KYC_ENC_PREFIX):
                continue  # already encrypted -- idempotent re-run
            bind.execute(
                sa.text(f"UPDATE {table} SET {column} = :val WHERE id = :id"),
                {"val": encrypt_kyc_field(plain_value), "id": row_id},
            )


def upgrade() -> None:
    op.alter_column(
        "customers",
        "tax_identification_number",
        existing_type=sa.String(length=50),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
    op.alter_column(
        "beneficial_owners",
        "tax_identification_number",
        existing_type=sa.String(length=50),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
    op.alter_column(
        "beneficial_owners",
        "id_number",
        existing_type=sa.String(length=50),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
    _encrypt_existing_plaintext_rows()


def downgrade() -> None:
    # Deliberately a no-op, not a column-width revert. Reverting the width
    # to VARCHAR(50) while leaving the encrypted (not decrypted -- see
    # below) values in place is actively unsafe, not just conservative:
    # confirmed live against Postgres that ALTER COLUMN ... TYPE
    # VARCHAR(50) fails outright once a real Fernet-encrypted value
    # (~104+ chars) is stored in the column (StringDataRightTruncation).
    # And decrypting rows back to plaintext on a routine `alembic
    # downgrade` is its own separate, deliberate decision -- a real
    # key-loss/rollback scenario, not something this migration should do
    # silently to live KYC identity numbers. So downgrading past this
    # revision leaves both the schema and the data exactly as upgrade()
    # left them; only a later migration that explicitly decides to
    # decrypt-then-narrow should touch this again.
    pass
