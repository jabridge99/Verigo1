"""
Tests for smr_service.py's AUSTRAC submission payload builder — the first
implementation of this payload (unlike ttr_service.py's, this had no prior
version to fix; SMR previously had no export path at all).
"""

from datetime import date

from app.models.report import SMRReport
from app.services.smr_service import build_smr_austrac_payload


def _smr(**overrides):
    defaults = dict(
        id="smr_test",
        org_id="org1",
        matter_date=date(2026, 1, 1),
        suspicion_grounds="Structuring pattern across multiple branches.",
        reporter_austrac_id="1234567",
    )
    defaults.update(overrides)
    return SMRReport(**defaults)


class TestHeaderAndSmDetails:
    def test_namespace_is_real_smr_schema(self):
        payload = build_smr_austrac_payload(_smr())
        assert payload["_namespace"] == "http://austrac.gov.au/schema/reporting/SMR-2-0"

    def test_sm_details_maps_designated_svcs_and_susp_reasons(self):
        report = _smr(
            designated_svcs=["ACC_DEP", "FIN_EFT"],
            susp_reason_codes=["PROCEEDS", "FRAUD"],
            grand_total=55000.0,
        )
        sm_details = build_smr_austrac_payload(report)["report"]["smDetails"]
        assert sm_details["designatedSvc"] == ["ACC_DEP", "FIN_EFT"]
        assert sm_details["suspReason"] == ["PROCEEDS", "FRAUD"]
        assert sm_details["grandTotal"] == 55000.0

    def test_susp_grounds_maps_from_suspicion_grounds(self):
        report = _smr(suspicion_grounds="Unusual cash structuring.")
        payload = build_smr_austrac_payload(report)
        assert payload["report"]["suspGrounds"] == {
            "groundsForSuspicion": "Unusual cash structuring."
        }


class TestSuspPerson:
    def test_legacy_subject_fields_map_into_first_susp_person(self):
        report = _smr(
            subject_name="Jane Suspect",
            subject_dob=date(1985, 5, 1),
            subject_address="1 Suspect St",
            subject_city="Testville",
            subject_abn="12345678901",
            subject_id_type="D",
            subject_id_number="DL123456",
        )
        persons = build_smr_austrac_payload(report)["report"]["suspPerson"]
        assert len(persons) == 1
        assert persons[0]["fullName"] == "Jane Suspect"
        assert persons[0]["abn"] == "12345678901"
        assert persons[0]["mainAddress"]["addr"] == "1 Suspect St"
        assert persons[0]["individualDetails"]["dob"] == "1985-05-01"
        assert persons[0]["identification"][0]["type"] == "D"
        assert persons[0]["identification"][0]["number"] == "DL123456"

    def test_no_legacy_subject_produces_empty_list_when_no_susp_persons_either(self):
        report = _smr()
        persons = build_smr_austrac_payload(report)["report"]["suspPerson"]
        assert persons == []

    def test_additional_susp_persons_json_entries_are_included(self):
        report = _smr(
            subject_name="Primary Suspect",
            susp_persons=[{"name": "Second Suspect", "abn": "98765432109"}],
        )
        persons = build_smr_austrac_payload(report)["report"]["suspPerson"]
        assert len(persons) == 2
        assert persons[0]["fullName"] == "Primary Suspect"
        assert persons[1]["fullName"] == "Second Suspect"
        assert persons[1]["abn"] == "98765432109"


class TestOtherAndUnidentPersons:
    def test_other_person_includes_relationship_and_agent_flag(self):
        report = _smr(
            other_persons=[
                {
                    "name": "Bob Associate",
                    "relationship": "business partner",
                    "party_is_agent": "Y",
                }
            ]
        )
        other = build_smr_austrac_payload(report)["report"]["otherPerson"]
        assert other[0]["fullName"] == "Bob Associate"
        assert other[0]["relationship"] == "business partner"
        assert other[0]["partyIsAgent"] == "Y"

    def test_unident_person_maps_description_and_docs(self):
        report = _smr(
            unident_persons=[
                {"desc_of_person": "Unknown male", "desc_of_docs": ["fake ID"]}
            ]
        )
        unident = build_smr_austrac_payload(report)["report"]["unidentPerson"]
        assert unident[0]["descOfPerson"] == "Unknown male"
        assert unident[0]["descOfDocs"] == ["fake ID"]


class TestTxnDetailPartyReferences:
    def test_sender_drawer_issuer_resolves_same_as_susp_person_reference(self):
        """senderDrawerIssuer can reference an existing suspPerson by index
        rather than repeating their details."""
        report = _smr(
            subject_name="Jane Suspect",
            txn_details=[
                {
                    "txn_date": date(2026, 1, 1),
                    "txn_type": "CD",
                    "txn_completed": "Y",
                    "txn_amount": "9500.00",
                    "sender_drawer_issuer": {"same_as_susp_person_index": 0},
                }
            ],
        )
        txn = build_smr_austrac_payload(report)["report"]["txnDetail"][0]
        assert txn["senderDrawerIssuer"] == {
            "sameAsSuspPerson": {"refId": "suspPerson[0]"}
        }
        assert txn["txnType"] == "CD"
        assert txn["txnAmount"] == "9500.00"

    def test_payee_without_reference_uses_standalone_fallback_fields(self):
        report = _smr(
            txn_details=[
                {
                    "txn_date": date(2026, 1, 1),
                    "txn_type": "CD",
                    "txn_completed": "Y",
                    "txn_amount": "500.00",
                    "payee": {"name": "Receiving Co", "account_number": "999"},
                }
            ],
        )
        txn = build_smr_austrac_payload(report)["report"]["txnDetail"][0]
        assert txn["payee"]["fullName"] == "Receiving Co"
        assert txn["payee"]["account"]["number"] == "999"

    def test_txn_type_other_uses_other_branch_not_txn_type(self):
        report = _smr(
            txn_details=[
                {
                    "txn_date": date(2026, 1, 1),
                    "txn_type_other": "OO",
                    "txn_type_other_desc": "Unusual method",
                    "txn_completed": "N",
                    "txn_amount": "100.00",
                }
            ],
        )
        txn = build_smr_austrac_payload(report)["report"]["txnDetail"][0]
        assert "txnType" not in txn
        assert txn["txnTypeOther"] == {
            "txnType": "OO",
            "txnTypeDesc": "Unusual method",
        }


class TestAdditionalDetails:
    def test_offence_and_prev_reported_map_correctly(self):
        report = _smr(
            offence_type="PROCEEDS",
            prev_reported_refs=["SMR-REF-001"],
        )
        additional = build_smr_austrac_payload(report)["report"]["additionalDetails"]
        assert additional["offence"] == "PROCEEDS"
        assert additional["prevReported"] == ["SMR-REF-001"]
