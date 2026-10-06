"""
SMR (Suspicious Matter Report) AUSTRAC submission payload builder.

Unlike TTR (app/services/ttr_service.py), which already had a payload
builder before this pass, SMR had none at all — this is the first
implementation, not a fidelity fix to an existing one. The SMRReport model
(app/models/report.py) is already closely schema-aligned to SMR-2-0.xsd
(its own comments cite the XSD element names and cardinality directly), so
this builder is mostly a direct transcription of that model into the real
schema's element tree.

Key design notes:

- susp_persons / other_persons / unident_persons / txn_details are stored
  as free-form JSON (no DB-enforced shape). This module defines the key
  contract each entry is expected to use — documented on each builder
  function below — since nothing else in the codebase establishes one yet.
  A susp_persons[] entry uses the same unprefixed keys as the legacy
  singular subject_* fields (e.g. "name" not "subject_name"), so one
  mapper (_person_payload) serves both the legacy subject_* fields and
  every susp_persons[]/other_persons[] JSON entry.

- senderDrawerIssuer/payee/beneficiary (inside txnDetail) and the
  sameAsSuspPerson/sameAsOtherPerson references they carry are schema
  IDREFs into the XML document's own id attributes. This payload is a
  JSON-shaped approximation of the schema's element tree (same convention
  TTR's payload already uses, same "review only" disclaimer) — it does not
  assign or track real XML `id`/IDREF attributes. A txnDetail entry can
  reference a suspPerson/otherPerson by that person's list index via
  "same_as_susp_person_index" / "same_as_other_person_index"; this module
  turns that into a readable `{"sameAsSuspPerson": {"refId": "suspPerson[N]"}}`
  placeholder rather than a schema-conformant IDREF.

DISCLAIMER: This builds a payload for review. The platform does not submit
to AUSTRAC automatically. Lodgement decisions and timing remain with the
reporting entity.
"""

from __future__ import annotations

from typing import Any, Optional

from app.models.report import SMRReport


def _fmt_date(d: Any) -> Optional[str]:
    if d is None:
        return None
    if hasattr(d, "strftime"):
        return d.strftime("%Y-%m-%d")
    return str(d)


def _build_identification(d: dict) -> dict:
    """SMR's <identification> extends the base Identification type with
    idIssueDate/idExpiryDate (SMR-2-0.xsd's own `identification` element)."""
    return {
        "type": d.get("id_type"),
        "number": d.get("id_number"),
        "issuer": d.get("id_issuer"),
        "country": d.get("id_country"),
        "idIssueDate": _fmt_date(d.get("id_issue_date")),
        "idExpiryDate": _fmt_date(d.get("id_expiry_date")),
    }


def _build_business_details(d: dict) -> Optional[dict]:
    if not any(
        d.get(k)
        for k in (
            "business_struct",
            "business_ben_name",
            "business_holder_name",
            "incorp_country",
        )
    ):
        return None
    return {
        "businessStruct": d.get("business_struct"),
        "benName": d.get("business_ben_name"),
        "holderName": d.get("business_holder_name"),
        "incorpCountry": d.get("incorp_country"),
    }


def _build_individual_details(d: dict) -> Optional[dict]:
    dob = d.get("dob")
    citizen_countries = d.get("citizen_countries")
    if not dob and not citizen_countries:
        return None
    return {
        "dob": _fmt_date(dob),
        "citizenCountry": citizen_countries or [],
    }


def _person_payload(d: dict) -> dict:
    """suspPerson/otherPerson shared shape (SMR-2-0.xsd: both elements
    carry an identical core person structure). `d` uses the unprefixed key
    contract documented on this module — the same shape the legacy
    subject_* fields reduce to once their "subject_" prefix is stripped."""
    account = None
    if d.get("account_number") or d.get("account_name"):
        account = {
            "title": d.get("account_name"),
            "bsb": d.get("account_bsb"),
            "number": d.get("account_number"),
        }
    identification = _build_identification(d) if d.get("id_number") else None
    return {
        "fullName": d.get("name"),
        "mainAddress": {
            "addr": d.get("address"),
            "suburb": d.get("city"),
            "state": d.get("state"),
            "postcode": d.get("postcode"),
            "country": d.get("country"),
        }
        if d.get("address")
        else None,
        "phone": d.get("phone"),
        "email": d.get("email"),
        "account": account,
        "digitalCurrencyWallet": d.get("digital_currency_wallets") or [],
        "indOcc": {"description": d.get("occupation")} if d.get("occupation") else None,
        "abn": d.get("abn"),
        "acn": d.get("acn"),
        "arbn": d.get("arbn"),
        "businessDetails": _build_business_details(d),
        "individualDetails": _build_individual_details(d),
        "identification": [identification] if identification else [],
        "electDataSrc": d.get("electronic_source"),
        "deviceIdentifier": d.get("device_identifier"),
        "personIsCustomer": d.get("is_customer"),
    }


def _subject_as_person(r: SMRReport) -> Optional[dict]:
    """Normalize the legacy singular subject_* fields into the same
    unprefixed shape _person_payload expects, so the primary suspect gets
    the same mapping as any additional susp_persons[] entry."""
    if not r.subject_name:
        return None
    return {
        "name": r.subject_name,
        "dob": r.subject_dob,
        "address": r.subject_address,
        "city": r.subject_city,
        "state": r.subject_state,
        "postcode": r.subject_postcode,
        "country": r.subject_country,
        "email": r.subject_email,
        "occupation": r.subject_occupation,
        "abn": r.subject_abn,
        "acn": r.subject_acn,
        "arbn": r.subject_arbn,
        "id_type": r.subject_id_type,
        "id_number": r.subject_id_number,
        "id_issue_date": r.subject_id_issue_date,
        "id_expiry_date": r.subject_id_expiry_date,
        "id_issuer": r.subject_id_issuer,
        "electronic_source": r.subject_electronic_source,
        "device_identifier": r.subject_device_identifier,
        "business_name": r.subject_business_name,
        "business_struct": r.subject_business_struct,
        "business_ben_name": r.subject_business_ben_name,
        "business_holder_name": r.subject_business_holder_name,
        "incorp_country": r.subject_incorp_country,
        "citizen_countries": r.subject_citizen_countries,
        "digital_currency_wallets": r.subject_digital_currency_wallets,
        "account_number": r.subject_account_number,
        "account_bsb": r.subject_account_bsb,
        "account_name": r.subject_account_name,
        "account_institution": r.subject_account_institution,
        "is_customer": r.subject_is_customer,
    }


def _build_susp_persons(r: SMRReport) -> list[dict]:
    """suspPerson[1..*] — the legacy primary subject fields (if set) plus
    any additional entries recorded in susp_persons[]."""
    persons = []
    primary = _subject_as_person(r)
    if primary:
        persons.append(_person_payload(primary))
    for entry in r.susp_persons or []:
        persons.append(_person_payload(entry))
    return persons


def _build_other_person(d: dict) -> dict:
    payload = _person_payload(d)
    payload["partyIsCustomer"] = d.get("party_is_customer")
    payload["partyIsAgent"] = d.get("party_is_agent")
    payload["relationship"] = d.get("relationship")
    payload["evidence"] = d.get("evidence")
    return payload


def _build_unident_person(d: dict) -> dict:
    return {
        "descOfPerson": d.get("desc_of_person"),
        "descOfDocs": d.get("desc_of_docs") or [],
    }


def _build_party_reference(d: dict) -> Optional[dict]:
    """See module docstring: a txnDetail party reference by list index,
    turned into a readable placeholder rather than a real XML IDREF."""
    if d.get("same_as_susp_person_index") is not None:
        return {
            "sameAsSuspPerson": {
                "refId": f"suspPerson[{d['same_as_susp_person_index']}]"
            }
        }
    if d.get("same_as_other_person_index") is not None:
        return {
            "sameAsOtherPerson": {
                "refId": f"otherPerson[{d['same_as_other_person_index']}]"
            }
        }
    return None


def _build_txn_party(d: Optional[dict]) -> Optional[dict]:
    """senderDrawerIssuer / payee / beneficiary — each either a reference
    to an existing suspPerson/otherPerson, or a standalone fallback person."""
    if not d:
        return None
    ref = _build_party_reference(d)
    if ref:
        return ref
    return {
        "fullName": d.get("name"),
        "mainAddress": {
            "addr": d.get("address"),
            "suburb": d.get("city"),
            "state": d.get("state"),
            "postcode": d.get("postcode"),
            "country": d.get("country"),
        }
        if d.get("address")
        else None,
        "phone": d.get("phone"),
        "email": d.get("email"),
        "account": {
            "title": d.get("account_name"),
            "bsb": d.get("account_bsb"),
            "number": d.get("account_number"),
        }
        if d.get("account_number")
        else None,
    }


def _build_txn_detail(d: dict) -> dict:
    """One txnDetail entry. `d`'s expected keys: txn_date, txn_type (a
    TransactionType code) or txn_type_other/txn_type_other_desc, tfr_type,
    txn_completed (Y/N), txn_ref_nos (list[str]), txn_amount, cash_amount,
    foreign_curr (list[{currency,amount}]), sender_drawer_issuer, payee,
    beneficiary (each the party shape _build_txn_party expects),
    other_institutions (list[{name, branch, country}])."""
    payload: dict = {
        "txnDate": _fmt_date(d.get("txn_date")),
        "txnCompleted": d.get("txn_completed"),
        "txnRefNo": d.get("txn_ref_nos") or [],
        "txnAmount": d.get("txn_amount"),
        "cashAmount": d.get("cash_amount"),
        "foreignCurr": d.get("foreign_curr") or [],
        "senderDrawerIssuer": _build_txn_party(d.get("sender_drawer_issuer")),
        "payee": _build_txn_party(d.get("payee")),
        "beneficiary": _build_txn_party(d.get("beneficiary")),
        "otherInstitution": d.get("other_institutions") or [],
    }
    if d.get("txn_type_other"):
        payload["txnTypeOther"] = {
            "txnType": d.get("txn_type_other"),
            "txnTypeDesc": d.get("txn_type_other_desc"),
        }
    else:
        payload["txnType"] = d.get("txn_type")
    if d.get("tfr_type"):
        payload["tfrType"] = d.get("tfr_type")
    return payload


def build_smr_austrac_payload(report: SMRReport) -> dict:
    """
    Build the AUSTRAC Connect API v2 submission payload for an SMR report,
    in the same XML-schema-aligned JSON structure TTR's
    build_austrac_submission_payload() already uses.

    XML schema namespace: http://austrac.gov.au/schema/reporting/SMR-2-0

    NOTE: AUSTRAC Connect API access requires accreditation and a signed
    Data Exchange Agreement. This returns the structured payload for
    review. Actual HTTP submission requires live OAuth 2.0 credentials.

    DISCLAIMER: Platform does not submit automatically. All lodgement
    decisions, including the suspicion assessment itself, remain entirely
    with the reporting entity.
    """
    return {
        "_namespace": "http://austrac.gov.au/schema/reporting/SMR-2-0",
        "reNumber": report.reporter_austrac_id,
        "reportCount": 1,
        "report": {
            "header": {
                "reReportRef": report.re_report_ref,
                "interceptFlag": report.intercept_flag,
                "reportingBranch": {
                    "branchId": report.reporting_branch_id,
                    "name": report.reporting_branch_name,
                    # BranchOptAddr's optional `address` (AddressNoCountry) is
                    # not captured anywhere on SMRReport — no branch address
                    # fields exist on the model, so this is omitted rather
                    # than guessed. See PARKING_LOT.md for this gap.
                },
            },
            "smDetails": {
                "designatedSvc": report.designated_svcs or [],
                "designatedSvcProvided": report.designated_svc_provided,
                "designatedSvcRequested": report.designated_svc_requested,
                "designatedSvcEnquiry": report.designated_svc_enquiry,
                "suspReason": report.susp_reason_codes or [],
                "grandTotal": report.grand_total,
            },
            "suspGrounds": {"groundsForSuspicion": report.suspicion_grounds},
            "suspPerson": _build_susp_persons(report),
            "otherPerson": [
                _build_other_person(d) for d in (report.other_persons or [])
            ],
            "unidentPerson": [
                _build_unident_person(d) for d in (report.unident_persons or [])
            ],
            "txnDetail": [
                _build_txn_detail(d) for d in (report.txn_details or [])
            ],
            "additionalDetails": {
                "offence": report.offence_type,
                "prevReported": report.prev_reported_refs or [],
                "otherAusGov": report.other_aus_gov_reports or [],
            },
        },
        "_submissionNote": (
            "PLACEHOLDER — Live submission requires AUSTRAC Connect API credentials "
            "and a signed Data Exchange Agreement. Contact AUSTRAC for accreditation. "
            "The decision to lodge this SMR remains entirely with the reporting entity."
        ),
    }
