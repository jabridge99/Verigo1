"""
Tests for ttr_service.py's AUSTRAC submission payload builder and CSV
export — specifically the non-cash breakdown fidelity fix (P32-style:
every real AUSTRAC TTR-FBS/GS/MSB element now has a field, and the
payload builder actually emits it) and the individualConductingTxn /
recipient / GS moneyReceived-vs-moneyProvided xs:choice correctness.

ISI is intentionally not covered — this platform does not serve the
investment/super/insurance sector.
"""

from datetime import date

from app.models.report import TTRIndustryType, TTRReport
from app.services.ttr_service import (
    NON_CASH_PROVIDED_SPEC,
    NON_CASH_RECEIVED_SPEC,
    build_austrac_submission_payload,
    generate_ttr_csv,
)


def _ttr(industry, detail, **overrides):
    defaults = dict(
        id="ttr_test",
        org_id="org1",
        transaction_date=date(2026, 1, 1),
        total_amount=15000.0,
        industry_type=industry,
        industry_detail=detail,
        customer_name="Test Customer",
        reporter_austrac_id="1234567",
    )
    defaults.update(overrides)
    return TTRReport(**defaults)


class TestNonCashBreakdownCompleteness:
    def test_fbs_spec_has_all_sixteen_received_and_nineteen_provided_elements(self):
        # Transcribed directly from TTR-FBS-3-0.xsd's nonCashReceived /
        # nonCashProvided complexTypes.
        received_codes = {c for c, _ in NON_CASH_RECEIVED_SPEC[TTRIndustryType.FBS]}
        provided_codes = {c for c, _ in NON_CASH_PROVIDED_SPEC[TTRIndustryType.FBS]}
        assert received_codes == {
            "fai", "iti", "dti", "chi", "bci", "bdi", "tci", "moi",
            "ldi", "ndi", "bpi", "dfi", "sei", "bui", "svi", "oti",
        }
        assert provided_codes == {
            "fao", "ito", "dto", "cho", "bco", "bdo", "tco", "moo",
            "hpo", "lro", "ndo", "cpo", "dfo", "seo", "buo", "sio",
            "sto", "fco", "oto",
        }

    def test_fbs_previously_missing_field_now_flows_into_payload(self):
        """bpi/dfi/sei/ldi/ndi were named in a comment but had no field at
        all before this fix — a compliance officer could never record them."""
        detail = {"designated_svc": "ACC_DEP", "non_cash_received_bpi": 500.0}
        report = _ttr(TTRIndustryType.FBS, detail)
        payload = build_austrac_submission_payload(report)
        non_cash = payload["report"]["transaction"]["moneyReceived"]["nonCashReceived"]
        assert non_cash["bpi"] == {"amount": 500.0}

    def test_fbs_other_element_carries_amount_and_description(self):
        detail = {
            "designated_svc": "ACC_DEP",
            "non_cash_provided_oto_amount": 10.0,
            "non_cash_provided_oto_desc": "miscellaneous",
        }
        report = _ttr(TTRIndustryType.FBS, detail)
        payload = build_austrac_submission_payload(report)
        oto = payload["report"]["transaction"]["moneyProvided"]["nonCashProvided"]["oto"]
        assert oto == {"amount": 10.0, "desc": "miscellaneous"}

    def test_msb_uses_real_schema_element_codes_not_generic_vocabulary(self):
        """The prior version collapsed chi/bci/bdi/tci/moi into one generic
        'cheque' field. Each is now its own real AUSTRAC element code."""
        detail = {
            "designated_svc": "RS",
            "non_cash_received_chi": 100.0,
            "non_cash_received_bci": 200.0,
        }
        report = _ttr(TTRIndustryType.MSB, detail)
        payload = build_austrac_submission_payload(report)
        non_cash = payload["report"]["transaction"]["moneyReceived"]["nonCashReceived"]
        assert non_cash["chi"] == {"amount": 100.0}
        assert non_cash["bci"] == {"amount": 200.0}

    def test_msb_ecurrency_element_carries_amount_and_description(self):
        detail = {
            "designated_svc": "RS",
            "non_cash_received_eci_amount": 50.0,
            "non_cash_received_eci_description": "BTC",
        }
        report = _ttr(TTRIndustryType.MSB, detail)
        payload = build_austrac_submission_payload(report)
        eci = payload["report"]["transaction"]["moneyReceived"]["nonCashReceived"]["eci"]
        assert eci == {"amount": 50.0, "description": "BTC"}


class TestFbsMsbBothDirectionsMandatory:
    def test_fbs_emits_both_money_received_and_provided(self):
        """FBS/MSB's schema requires both moneyReceived and moneyProvided
        elements present (not a choice) — each one's own children stay
        optional."""
        detail = {"designated_svc": "ACC_DEP"}
        report = _ttr(TTRIndustryType.FBS, detail)
        payload = build_austrac_submission_payload(report)
        txn = payload["report"]["transaction"]
        assert "moneyReceived" in txn
        assert "moneyProvided" in txn
        assert txn["moneyReceived"] == {}
        assert txn["moneyProvided"] == {}


class TestGsChoiceStructure:
    def test_gs_emits_only_money_received_when_direction_is_received(self):
        """GS's schema makes moneyReceived/moneyProvided a genuine
        xs:choice — only one may ever be present."""
        detail = {
            "designated_svc": "GAM_BETT",
            "gambling_txn_direction": "money_received",
            "cash_aud_received": 300.0,
        }
        report = _ttr(TTRIndustryType.GS, detail)
        payload = build_austrac_submission_payload(report)
        txn = payload["report"]["transaction"]
        assert "moneyReceived" in txn
        assert "moneyProvided" not in txn

    def test_gs_emits_only_money_provided_when_direction_is_provided(self):
        detail = {
            "designated_svc": "GAM_BETT",
            "gambling_txn_direction": "money_provided",
            "cash_aud_provided": 300.0,
        }
        report = _ttr(TTRIndustryType.GS, detail)
        payload = build_austrac_submission_payload(report)
        txn = payload["report"]["transaction"]
        assert "moneyProvided" in txn
        assert "moneyReceived" not in txn

    def test_gs_contra_field_nests_under_correct_contra_key_not_plain_provided(self):
        """`mro` (manual refund out) only exists in nonCashContraProvided,
        not the plain nonCashProvided — the prior version mislabelled it
        under the plain 'non_cash_provided' group."""
        detail = {
            "designated_svc": "GAM_EXCH",
            "gambling_txn_direction": "money_received",
            "non_cash_contra_provided_mro": 50.0,
        }
        report = _ttr(TTRIndustryType.GS, detail)
        payload = build_austrac_submission_payload(report)
        money_received = payload["report"]["transaction"]["moneyReceived"]
        assert money_received["nonCashContraProvided"]["mro"] == {"amount": 50.0}
        assert "nonCashProvided" not in money_received


class TestIndividualConductingTxnChoice:
    def test_same_as_customer_true_emits_only_that_key(self):
        """xs:choice: sameAsCustomer OR the full fallback sequence, never
        both (the prior version emitted both unconditionally)."""
        detail = {"designated_svc": "ACC_DEP"}
        report = _ttr(TTRIndustryType.FBS, detail)
        payload = build_austrac_submission_payload(report)
        assert payload["report"]["individualConductingTxn"] == {"sameAsCustomer": True}

    def test_same_as_customer_false_emits_only_fallback_fields(self):
        detail = {
            "designated_svc": "ACC_DEP",
            "individual_conducting_txn_same_as_customer": False,
            "individual_conducting_txn_full_name": "Someone Else",
        }
        report = _ttr(TTRIndustryType.FBS, detail)
        payload = build_austrac_submission_payload(report)
        txn = payload["report"]["individualConductingTxn"]
        assert "sameAsCustomer" not in txn
        assert txn["fullName"] == "Someone Else"


class TestRecipient:
    def test_recipient_was_missing_entirely_before_this_fix(self):
        """recipient (1..unbounded, REQUIRED) had no key in the payload at
        all before this fix."""
        detail = {"designated_svc": "ACC_DEP"}
        report = _ttr(TTRIndustryType.FBS, detail)
        payload = build_austrac_submission_payload(report)
        assert "recipient" in payload["report"]

    def test_recipient_defaults_to_same_as_customer_when_no_third_party(self):
        detail = {"designated_svc": "ACC_DEP"}
        report = _ttr(TTRIndustryType.FBS, detail)
        payload = build_austrac_submission_payload(report)
        assert payload["report"]["recipient"] == {"sameAsCustomer": True}

    def test_recipient_uses_third_party_fields_when_present(self):
        detail = {"designated_svc": "ACC_DEP"}
        report = _ttr(
            TTRIndustryType.FBS,
            detail,
            third_party_name="Jane Recipient",
            third_party_relationship="spouse",
        )
        payload = build_austrac_submission_payload(report)
        assert payload["report"]["recipient"] == {
            "fullName": "Jane Recipient",
            "relationship": "spouse",
        }


class TestCsvExportColumns:
    def test_fbs_csv_includes_previously_missing_non_cash_column(self):
        detail = {"designated_svc": "ACC_DEP", "non_cash_received_sei": 42.0}
        report = _ttr(TTRIndustryType.FBS, detail)
        csv_text = generate_ttr_csv(report)
        header_row = csv_text.splitlines()[0]
        data_row = csv_text.splitlines()[1]
        assert "non_cash_received_sei" in header_row
        col_index = header_row.split(",").index("non_cash_received_sei")
        assert data_row.split(",")[col_index] == "42.0"

    def test_msb_csv_uses_real_schema_code_column(self):
        detail = {"designated_svc": "RS", "non_cash_received_chi": 15.0}
        report = _ttr(TTRIndustryType.MSB, detail)
        csv_text = generate_ttr_csv(report)
        assert "non_cash_received_chi" in csv_text.splitlines()[0]
        assert "non_cash_received_cheque_amount" not in csv_text.splitlines()[0]
