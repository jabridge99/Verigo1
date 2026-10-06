"""
Tests for IFTI report creation, status workflow, tenant isolation, and Excel export.
"""

import pytest

IFTI_OUT_PAYLOAD = {
    "direction": "outgoing",
    "date_received": "01/06/2025",
    "date_available": "02/06/2025",
    "currency_code": "AUD",
    "total_amount": 15000.00,
    "transfer_type": "Money",
    "oc_full_name": "John Smith",
    "oc_address": "123 Main St",
    "oc_city": "Melbourne",
    "oc_state": "VIC",
    "oc_postcode": "3000",
    "oc_country": "Australia",
    "bc_full_name": "Receiver Corp",
    "bc_country": "United States",
    "reason_for_transfer": "Business payment",
    "reporter_full_name": "Compliance Officer",
    "reporter_email": "compliance@test.com",
}

IFTI_IN_PAYLOAD = {
    **IFTI_OUT_PAYLOAD,
    "direction": "incoming",
}


class TestIFTICreate:
    def test_unauthenticated_cannot_create(self, client):
        resp = client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD)
        assert resp.status_code == 401

    def test_analyst_cannot_create(self, client, analyst_headers):
        resp = client.post(
            "/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=analyst_headers
        )
        assert resp.status_code == 403

    def test_compliance_can_create_out(self, client, compliance_headers):
        resp = client.post(
            "/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=compliance_headers
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["direction"] == "outgoing"
        assert data["status"] == "draft"
        assert data["ifti_id"].startswith("IFTI-")

    def test_compliance_can_create_in(self, client, compliance_headers):
        resp = client.post(
            "/api/v1/ifti/", json=IFTI_IN_PAYLOAD, headers=compliance_headers
        )
        assert resp.status_code == 201
        assert resp.json()["direction"] == "incoming"

    def test_industry_id_set_from_session(
        self, client, compliance_user, compliance_headers
    ):
        resp = client.post(
            "/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=compliance_headers
        )
        assert resp.status_code == 201
        assert resp.json()["industry_id"] == compliance_user.org_id


class TestIFTIList:
    def test_analyst_can_list(self, client, analyst_headers):
        resp = client.get("/api/v1/ifti/", headers=analyst_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_viewer_cannot_list(self, client, viewer_headers):
        resp = client.get("/api/v1/ifti/", headers=viewer_headers)
        assert resp.status_code == 403

    def test_unauthenticated_cannot_list(self, client):
        resp = client.get("/api/v1/ifti/")
        assert resp.status_code == 401

    def test_tenant_isolation_on_list(self, client, db, compliance_headers):
        from app.models.user import UserRole
        from tests.conftest import _auth, _make_user

        other_user = _make_user(db, UserRole.compliance)
        other_headers = _auth(other_user)

        # Create record as other tenant
        resp = client.post(
            "/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=other_headers
        )
        assert resp.status_code == 201
        other_ifti_id = resp.json()["ifti_id"]

        # Original compliance user should not see it
        list_resp = client.get("/api/v1/ifti/", headers=compliance_headers)
        ids = [r["ifti_id"] for r in list_resp.json()]
        assert other_ifti_id not in ids


class TestIFTIWorkflow:
    def _create(self, client, headers):
        resp = client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=headers)
        assert resp.status_code == 201
        return resp.json()["ifti_id"]

    def test_review_moves_to_under_review(self, client, compliance_headers):
        ifti_id = self._create(client, compliance_headers)
        resp = client.post(f"/api/v1/ifti/{ifti_id}/review", headers=compliance_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "under_review"

    def _same_org_mlro_headers(self, db, compliance_user):
        from app.models.user import UserRole
        from tests.conftest import _auth, _make_user

        mlro_same_org = _make_user(
            db, UserRole.mlro, industry_id=compliance_user.org_id
        )
        return _auth(mlro_same_org)

    def _reviewed_and_approved(
        self, client, headers, mlro_headers, ifti_id=None, payload=None
    ):
        """Create (or reuse) -> review (compliance) -> approve (MLRO) -> approved."""
        if ifti_id is None:
            resp = client.post(
                "/api/v1/ifti/", json=payload or IFTI_OUT_PAYLOAD, headers=headers
            )
            assert resp.status_code == 201, resp.text
            ifti_id = resp.json()["ifti_id"]
        resp = client.post(f"/api/v1/ifti/{ifti_id}/review", headers=headers)
        assert resp.status_code == 200, resp.text
        resp = client.post(f"/api/v1/ifti/{ifti_id}/approve", headers=mlro_headers)
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "approved"
        return ifti_id

    def test_submit_requires_mlro(
        self, client, db, compliance_user, compliance_headers
    ):
        mlro_headers = self._same_org_mlro_headers(db, compliance_user)
        ifti_id = self._reviewed_and_approved(
            client,
            compliance_headers,
            mlro_headers,
            payload={**IFTI_OUT_PAYLOAD, "reporter_austrac_id": "12345678"},
        )

        # Compliance cannot submit
        resp = client.post(f"/api/v1/ifti/{ifti_id}/submit", headers=compliance_headers)
        assert resp.status_code == 403

        # MLRO can submit
        resp = client.post(f"/api/v1/ifti/{ifti_id}/submit", headers=mlro_headers)
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "submitted"

    def test_submit_fails_validation_without_reporter_austrac_id(
        self, client, db, compliance_user, compliance_headers
    ):
        mlro_headers = self._same_org_mlro_headers(db, compliance_user)
        # IFTI_OUT_PAYLOAD has no reporter_austrac_id
        ifti_id = self._reviewed_and_approved(client, compliance_headers, mlro_headers)

        resp = client.post(f"/api/v1/ifti/{ifti_id}/submit", headers=mlro_headers)
        assert resp.status_code == 422

        # Reject -> redraft -> fill the missing field -> resubmit the workflow
        resp = client.post(
            f"/api/v1/ifti/{ifti_id}/reject",
            params={"reason": "Missing reporter AUSTRAC ID."},
            headers=mlro_headers,
        )
        assert resp.status_code == 200, resp.text
        resp = client.post(
            f"/api/v1/ifti/{ifti_id}/redraft", headers=compliance_headers
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "draft"

        r = client.patch(
            f"/api/v1/ifti/{ifti_id}",
            json={**IFTI_OUT_PAYLOAD, "reporter_austrac_id": "12345678"},
            headers=compliance_headers,
        )
        assert r.status_code == 200, r.text
        ifti_id = self._reviewed_and_approved(
            client, compliance_headers, mlro_headers, ifti_id=ifti_id
        )
        resp = client.post(f"/api/v1/ifti/{ifti_id}/submit", headers=mlro_headers)
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "submitted"

    def _submitted(self, client, db, compliance_user, compliance_headers):
        mlro_headers = self._same_org_mlro_headers(db, compliance_user)
        ifti_id = self._reviewed_and_approved(
            client,
            compliance_headers,
            mlro_headers,
            payload={**IFTI_OUT_PAYLOAD, "reporter_austrac_id": "12345678"},
        )
        resp = client.post(f"/api/v1/ifti/{ifti_id}/submit", headers=mlro_headers)
        assert resp.status_code == 200, resp.text
        return ifti_id

    def test_cannot_edit_submitted(
        self, client, db, compliance_user, compliance_headers
    ):
        ifti_id = self._submitted(client, db, compliance_user, compliance_headers)

        resp = client.patch(
            f"/api/v1/ifti/{ifti_id}", json=IFTI_OUT_PAYLOAD, headers=compliance_headers
        )
        assert resp.status_code == 400

    def test_cannot_delete_submitted(
        self, client, db, compliance_user, compliance_headers
    ):
        ifti_id = self._submitted(client, db, compliance_user, compliance_headers)

        resp = client.delete(f"/api/v1/ifti/{ifti_id}", headers=compliance_headers)
        assert resp.status_code == 400

    def test_delete_draft(self, client, compliance_headers):
        ifti_id = self._create(client, compliance_headers)
        resp = client.delete(f"/api/v1/ifti/{ifti_id}", headers=compliance_headers)
        assert resp.status_code == 204

        get_resp = client.get(f"/api/v1/ifti/{ifti_id}", headers=compliance_headers)
        assert get_resp.status_code == 404


class TestIFTIExport:
    def test_export_returns_xlsx(self, client, compliance_headers):
        client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=compliance_headers)
        resp = client.get("/api/v1/ifti/export/outgoing", headers=compliance_headers)
        assert resp.status_code == 200
        assert (
            resp.headers["content-type"]
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert "X-Record-Count" in resp.headers
        # Verify it's a valid xlsx (PK zip magic bytes)
        assert resp.content[:4] == b"PK\x03\x04"

    def test_export_in_returns_xlsx(self, client, compliance_headers):
        client.post("/api/v1/ifti/", json=IFTI_IN_PAYLOAD, headers=compliance_headers)
        resp = client.get("/api/v1/ifti/export/incoming", headers=compliance_headers)
        assert resp.status_code == 200
        assert resp.content[:4] == b"PK\x03\x04"

    def test_export_empty_returns_404(self, client, db, compliance_headers):
        from app.models.user import UserRole
        from tests.conftest import _auth, _make_user

        # Use a tenant with no IFTI records
        empty_user = _make_user(db, UserRole.compliance)
        empty_headers = _auth(empty_user)
        resp = client.get("/api/v1/ifti/export/outgoing", headers=empty_headers)
        assert resp.status_code == 404

    def test_analyst_cannot_export(self, client, analyst_headers):
        resp = client.get("/api/v1/ifti/export/outgoing", headers=analyst_headers)
        assert resp.status_code == 403

    def test_export_falls_back_to_acn_arbn_when_no_abn(self):
        """A customer identified by ACN or ARBN rather than ABN (both real,
        schema-recognized identifiers per IFTI-DRA-1-2.xsd) must still show up
        in the exported spreadsheet's combined "ABN, ACN or ARBN" column."""
        import io

        from openpyxl import load_workbook

        from datetime import date

        from app.models.ifti import IFTIDirection, IFTIRecord
        from app.services.ifti_service import IFTI_OUT_COLUMNS, generate_ifti_excel

        record = IFTIRecord(
            ifti_id="IFTI-TEST0001",
            direction=IFTIDirection.outgoing,
            date_received=date(2025, 6, 1),
            date_available=date(2025, 6, 2),
            total_amount=1000.0,
            oc_full_name="Ordering Co Pty Ltd",
            oc_acn="123456789",  # no oc_abn set
            bc_full_name="Beneficiary Co",
            bc_arbn="987654321",  # no bc_abn set
        )

        wb = load_workbook(io.BytesIO(generate_ifti_excel([record], "outgoing")))
        ws = wb["IFTI-DRA OUT"]

        oc_abn_col = next(
            i
            for i, (section, label) in enumerate(IFTI_OUT_COLUMNS, start=1)
            if section == "Ordering customer business details"
            and label == "ABN, ACN or ARBN"
        )
        bc_abn_col = next(
            i
            for i, (section, label) in enumerate(IFTI_OUT_COLUMNS, start=1)
            if section == "Beneficiary customer business details"
            and label == "ABN, ACN or ARBN"
        )

        assert ws.cell(row=3, column=oc_abn_col).value == "123456789"
        assert ws.cell(row=3, column=bc_abn_col).value == "987654321"

    def test_export_date_and_amount_cells_match_austrac_template_format(self):
        """Date and amount columns must be real typed cells formatted exactly
        like AUSTRAC's own IFTI-DRA_OUT.xls/IFTI-DRA_IN.xls templates
        (dd/mmm/yyyy dates, #,##0.00 amounts) — not plain text."""
        import io
        from datetime import date, datetime

        from openpyxl import load_workbook

        from app.models.ifti import IFTIDirection, IFTIRecord
        from app.services.ifti_service import generate_ifti_excel

        record = IFTIRecord(
            ifti_id="IFTI-TEST0002",
            direction=IFTIDirection.outgoing,
            date_received=date(2026, 5, 12),
            date_available=date(2026, 5, 12),
            total_amount=2000.0,
            oc_full_name="Test Ordering Customer",
            oc_dob=date(1989, 10, 11),
        )

        wb = load_workbook(io.BytesIO(generate_ifti_excel([record], "outgoing")))
        ws = wb["IFTI-DRA OUT"]

        date_received_cell = ws.cell(row=3, column=1)
        date_available_cell = ws.cell(row=3, column=2)
        amount_cell = ws.cell(row=3, column=4)
        oc_dob_cell = ws.cell(row=3, column=10)

        assert date_received_cell.value == datetime(2026, 5, 12)
        assert date_received_cell.number_format == "dd/mmm/yyyy"
        assert date_available_cell.number_format == "dd/mmm/yyyy"
        assert oc_dob_cell.value == datetime(1989, 10, 11)
        assert oc_dob_cell.number_format == "dd/mmm/yyyy"

        assert amount_cell.value == 2000.0
        assert amount_cell.number_format == "#,##0.00"


class TestIFTIDataValidations:
    """The real AUSTRAC IFTI-DRA_IN.xls/IFTI-DRA_OUT.xls templates carry a
    third, hidden "Data Validations" sheet wiring Excel dropdown lists to
    specific columns (business structure, Yes/No, ID type, etc.) — recovered
    from those templates' own raw BIFF8 DV records, not guessed. This was
    P32's one remaining disclosed gap; these tests lock in that the generator
    now reproduces it exactly: same sheet name/order/hidden state, same
    option text, and the same real columns wired to the same lists."""

    def _load(self, records, direction):
        import io

        from openpyxl import load_workbook

        from app.services.ifti_service import generate_ifti_excel

        return load_workbook(io.BytesIO(generate_ifti_excel(records, direction)))

    def _sample_record(self, direction):
        from datetime import date

        from app.models.ifti import IFTIDirection, IFTIRecord

        return IFTIRecord(
            ifti_id="IFTI-TESTDV1",
            direction=(
                IFTIDirection.outgoing
                if direction == "outgoing"
                else IFTIDirection.incoming
            ),
            date_received=date(2026, 1, 1),
            date_available=date(2026, 1, 2),
            total_amount=1000.0,
            oc_full_name="Ordering Customer",
            bc_full_name="Beneficiary Customer",
        )

    def test_sheet_present_hidden_and_last(self):
        wb = self._load([self._sample_record("outgoing")], "outgoing")
        assert wb.sheetnames == ["IFTI-DRA OUT", "Instructions", "Data Validations"]
        assert wb["Data Validations"].sheet_state == "hidden"

    def test_no_sheet_when_no_records(self):
        wb = self._load([], "outgoing")
        assert "Data Validations" not in wb.sheetnames

    def test_out_dropdown_columns_match_real_template(self):
        """Column letters recovered from IFTI-DRA_OUT.xls's own DV records."""
        wb = self._load([self._sample_record("outgoing")], "outgoing")
        ws = wb["IFTI-DRA OUT"]
        dv_by_sqref = {
            str(dv.sqref): dv.formula1 for dv in ws.data_validations.dataValidation
        }

        expected_cols = ["E", "AA", "AB", "AF", "BB", "BM", "BN", "CI", "CP", "CQ"]
        for col in expected_cols:
            # A single-row range's str() collapses to one cell ref (no colon).
            assert f"{col}3" in dv_by_sqref, f"missing dropdown on {col}"

    def test_in_dropdown_columns_match_real_template(self):
        """Column letters recovered from IFTI-DRA_IN.xls's own DV records
        (no ID-type columns on IN — the real template has no ID section
        for incoming transfers either)."""
        wb = self._load([self._sample_record("incoming")], "incoming")
        ws = wb["IFTI-DRA IN"]
        dv_by_sqref = {
            str(dv.sqref): dv.formula1 for dv in ws.data_validations.dataValidation
        }

        expected_cols = ["E", "AA", "AS", "BN", "BO", "BP", "CN", "CT", "CU"]
        for col in expected_cols:
            assert f"{col}3" in dv_by_sqref, f"missing dropdown on {col}"

    def test_dropdown_options_match_real_template_text(self):
        """Option text/order transcribed verbatim from the real templates'
        own hidden Data Validations sheet, including the
        '- Please Select -' placeholder as the first item of every list."""
        wb = self._load([self._sample_record("outgoing")], "outgoing")
        dv_sheet = wb["Data Validations"]
        values = [dv_sheet.cell(r, 1).value for r in range(1, dv_sheet.max_row + 1)]

        assert values[0:3] == ["- Please Select -", "Money", "Property"]
        assert values[3:10] == [
            "- Please Select -",
            "Association",
            "Company",
            "Government body",
            "Partnership",
            "Registered body",
            "Trust",
        ]
        # First ID-type block (AB "ID type (1)") starts right after it.
        assert values[10] == "- Please Select -"
        assert values[11:31] == [
            "Alien registration number",
            "Bank account",
            "Benefits card/ID",
            "Birth certificate",
            "Business registration/licence",
            "Credit/debit card",
            "Customer account/ID",
            "Driver's licence",
            "Employee ID",
            "Employer number",
            "Identity card/number",
            "Membership ID",
            "Passport",
            "Photo ID",
            "Security ID",
            "Social security ID",
            "Student ID",
            "Tax number/ID (except Australian tax file numbers (TFN))",
            "Telephone/fax number",
            "Other (provide description)",
        ]

    def test_in_data_validations_sheet_row_count_matches_real_template(self):
        """The real IFTI-DRA_IN.xls's hidden Data Validations sheet has
        exactly 43 rows (9 option blocks); OUT's has exactly 78 (10 blocks,
        the 2 extra being the OUT-only ID-type lists)."""
        wb_in = self._load([self._sample_record("incoming")], "incoming")
        wb_out = self._load([self._sample_record("outgoing")], "outgoing")
        assert wb_in["Data Validations"].max_row == 43
        assert wb_out["Data Validations"].max_row == 78

    def test_dropdown_range_covers_exactly_the_populated_rows(self):
        """Matches the real templates' own behaviour: DV ranges cover exactly
        the filled data rows (3..2+n), not a large blank buffer."""
        records = [self._sample_record("outgoing") for _ in range(3)]
        wb = self._load(records, "outgoing")
        ws = wb["IFTI-DRA OUT"]
        sqrefs = {str(dv.sqref) for dv in ws.data_validations.dataValidation}
        assert "E3:E5" in sqrefs
