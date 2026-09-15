"""
P51: Customer.tax_identification_number, BeneficialOwner.tax_identification_number
and BeneficialOwner.id_number are now encrypted at rest via
app.services.crypto.EncryptedKycString, a SQLAlchemy TypeDecorator applied
at the ORM layer -- not patched in at individual call sites -- so every
write path is covered automatically, including the beneficial-owner
route's dict-spread construction (BeneficialOwner(**payload.model_dump())).

Tests go through the real API (POST /customers, POST .../beneficial-owners)
and then inspect the raw database row directly via SQL, bypassing the ORM,
to prove the plaintext value the caller sent never actually reaches disk --
not just that the ORM round-trips it correctly (which alone wouldn't rule
out a broken/no-op encryption layer).
"""

import uuid

from sqlalchemy import text

from app.models.customer import BeneficialOwner, Customer
from app.services.crypto import (
    KYC_ENC_PREFIX,
    decrypt_kyc_field,
    encrypt_kyc_field,
    is_kyc_encrypted,
)
from tests.conftest import _auth


class TestEncryptKycFieldRoundtrip:
    def test_roundtrip(self):
        token = encrypt_kyc_field("123456789")
        assert token.startswith(KYC_ENC_PREFIX)
        assert token != "123456789"
        assert decrypt_kyc_field(token) == "123456789"

    def test_none_and_empty_pass_through_unencrypted(self):
        assert encrypt_kyc_field(None) is None
        assert encrypt_kyc_field("") == ""

    def test_decrypt_passes_through_legacy_plaintext_unencrypted(self):
        # Values written before this feature existed have no "kyc:" prefix.
        # decrypt_kyc_field() must return them as-is rather than raise --
        # the migration re-encrypts existing rows, but any row this code
        # hasn't reached yet (e.g. a read racing the migration) must not
        # crash the request.
        assert decrypt_kyc_field("123456789") == "123456789"

    def test_is_kyc_encrypted(self):
        assert is_kyc_encrypted(encrypt_kyc_field("123456789")) is True
        assert is_kyc_encrypted("123456789") is False
        assert is_kyc_encrypted(None) is False

    def test_two_encryptions_of_the_same_value_differ(self):
        # Fernet embeds a random IV + timestamp -- non-deterministic by
        # design. Confirms this column can never be used in an equality
        # filter (encrypting a search term wouldn't match the stored token).
        assert encrypt_kyc_field("123456789") != encrypt_kyc_field("123456789")


class TestCustomerTaxIdEncryptedAtRest:
    def test_create_customer_via_api_encrypts_tax_id_on_disk(self, client, db, admin_user):
        headers = _auth(admin_user)
        resp = client.post(
            "/api/v1/customers/",
            json={
                "full_name": "TFN Test Customer",
                "email": f"tfn-{uuid.uuid4().hex[:6]}@example.com",
                "phone": "+61400000090",
                "date_of_birth": "1990-01-01",
                "nationality": "AU",
                "country_of_residence": "AU",
                "id_number": "PP12345678",
                "id_type": "passport",
                "address": "1 TFN St, Sydney NSW 2000",
                "industry": "banking",
                "tax_identification_number": "123456789",
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        customer_id = resp.json()["id"]
        # CustomerResponse doesn't expose tax_identification_number at all
        # (a pre-existing, unrelated omission -- not something this change
        # affects either way), so the only way to observe the real value is
        # via the DB directly.

        # The raw database row -- read via SQL, bypassing the ORM's
        # own decrypt-on-read -- must never contain the plaintext.
        raw = db.execute(
            text("SELECT tax_identification_number FROM customers WHERE id = :id"),
            {"id": customer_id},
        ).scalar()
        assert raw is not None
        assert raw.startswith(KYC_ENC_PREFIX)
        assert raw != "123456789"
        assert "123456789" not in raw

        # And the ORM, in a fresh query, decrypts it back correctly.
        db.expire_all()
        customer = db.query(Customer).filter_by(id=customer_id).first()
        assert customer.tax_identification_number == "123456789"

    def test_null_tax_id_stays_null(self, client, db, admin_user):
        headers = _auth(admin_user)
        resp = client.post(
            "/api/v1/customers/",
            json={
                "full_name": "No TFN Customer",
                "email": f"notfn-{uuid.uuid4().hex[:6]}@example.com",
                "phone": "+61400000089",
                "date_of_birth": "1990-01-01",
                "nationality": "AU",
                "country_of_residence": "AU",
                "id_number": "PP87654321",
                "id_type": "passport",
                "address": "1 No TFN St, Sydney NSW 2000",
                "industry": "banking",
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        customer_id = resp.json()["id"]
        db.expire_all()
        customer = db.query(Customer).filter_by(id=customer_id).first()
        assert customer.tax_identification_number is None


class TestBeneficialOwnerFieldsEncryptedAtRest:
    def test_add_beneficial_owner_via_api_encrypts_both_fields_on_disk(
        self, client, db, admin_user
    ):
        headers = _auth(admin_user)
        customer_resp = client.post(
            "/api/v1/customers/",
            json={
                "full_name": "UBO Parent Customer",
                "email": f"ubo-{uuid.uuid4().hex[:6]}@example.com",
                "phone": "+61400000088",
                "date_of_birth": "1990-01-01",
                "nationality": "AU",
                "country_of_residence": "AU",
                "id_number": "PP11223344",
                "id_type": "passport",
                "address": "1 UBO St, Sydney NSW 2000",
                "industry": "banking",
                "customer_type": "company",
            },
            headers=headers,
        )
        assert customer_resp.status_code == 201, customer_resp.text
        customer_id = customer_resp.json()["id"]

        ubo_resp = client.post(
            f"/api/v1/customers/{customer_id}/beneficial-owners",
            json={
                "ubo_type": "direct_owner",
                "full_name": "John UBO",
                "tax_identification_number": "987654321",
                "id_type": "passport",
                "id_number": "PP99998888",
                "ownership_percentage": 40,
            },
            headers=headers,
        )
        assert ubo_resp.status_code == 201, ubo_resp.text
        ubo_id = ubo_resp.json()["id"]

        # Raw row on disk must be encrypted for BOTH fields -- this is
        # exactly the BeneficialOwner(**payload.model_dump()) dict-spread
        # construction path, proving the ORM-level type covers it even
        # though no individual call site was patched for this field.
        raw = db.execute(
            text(
                "SELECT tax_identification_number, id_number FROM beneficial_owners WHERE id = :id"
            ),
            {"id": ubo_id},
        ).fetchone()
        raw_tin, raw_id_number = raw
        assert raw_tin.startswith(KYC_ENC_PREFIX)
        assert raw_tin != "987654321"
        assert raw_id_number.startswith(KYC_ENC_PREFIX)
        assert raw_id_number != "PP99998888"

        db.expire_all()
        ubo = db.query(BeneficialOwner).filter_by(id=ubo_id).first()
        assert ubo.tax_identification_number == "987654321"
        assert ubo.id_number == "PP99998888"
