"""encrypt user mfa secret at rest

Stage 17: User.mfa_secret (the TOTP seed) was stored as plain text -- a
compromised database read or backup leak would hand over a full MFA
bypass for every enrolled user, no different in severity from the KYC
identity numbers P51 already encrypted. Now encrypted at rest via the
ORM's new EncryptedMfaSecret column type (app/services/crypto.py), keyed
off a dedicated MFA_ENCRYPTION_KEY (falls back to SECRET_KEY if unset,
same dev-convenience pattern as STORAGE_ENCRYPTION_KEY/KYC_ENCRYPTION_KEY).

Two steps, in order:
  1. Widen users.mfa_secret from VARCHAR(64) to VARCHAR(255) -- a
     Fernet-encrypted token for a 32-char base32 TOTP seed (~140 chars
     incl. the "mfa:" prefix) doesn't fit in the old width.
  2. Re-encrypt every existing plaintext value in place. A schema change
     alone does not encrypt rows that already exist -- this is a real
     one-time data migration over live MFA secrets, not a reversible
     cosmetic tweak. Idempotent: skips any value that already carries the
     "mfa:" prefix, safe to re-run.

Revision ID: 3de01cf6adc4
Revises: 181b4a494ffe
Create Date: 2026-09-16 01:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3de01cf6adc4"
down_revision: Union[str, None] = "181b4a494ffe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _encrypt_existing_plaintext_rows() -> None:
    # Imported here (not at module scope) so a plain `alembic history`/
    # `alembic heads` invocation never needs the app's settings/crypto
    # stack importable -- only running this migration's upgrade() does.
    from app.services.crypto import MFA_ENC_PREFIX, encrypt_mfa_secret

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, mfa_secret FROM users "
            "WHERE mfa_secret IS NOT NULL AND mfa_secret != ''"
        )
    ).fetchall()
    for row_id, plain_value in rows:
        if plain_value.startswith(MFA_ENC_PREFIX):
            continue  # already encrypted -- idempotent re-run
        bind.execute(
            sa.text("UPDATE users SET mfa_secret = :val WHERE id = :id"),
            {"val": encrypt_mfa_secret(plain_value), "id": row_id},
        )


def upgrade() -> None:
    op.alter_column(
        "users",
        "mfa_secret",
        existing_type=sa.String(length=64),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
    _encrypt_existing_plaintext_rows()


def downgrade() -> None:
    # Deliberately a no-op, not a column-width revert -- same reasoning as
    # P51's migration (19838395f614): narrowing back to VARCHAR(64) while
    # encrypted (~140+ char) values are still in the column fails outright
    # on Postgres (StringDataRightTruncation), and decrypting rows back to
    # plaintext on a routine `alembic downgrade` is its own separate,
    # deliberate decision -- not something this migration should do
    # silently to live MFA secrets. Downgrading past this revision leaves
    # both the schema and the data exactly as upgrade() left them.
    pass
