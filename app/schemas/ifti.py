from datetime import date as _date_type
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_serializer

from app.models.ifti import IFTIDirection, IFTIStatus


class IFTICreate(BaseModel):
    direction: IFTIDirection
    date_received: str  # DD/MM/YYYY
    date_available: str  # DD/MM/YYYY
    currency_code: str = "AUD"
    total_amount: float
    transfer_type: str = "Money"
    property_description: Optional[str] = None
    transaction_reference: Optional[str] = None

    # Ordering customer
    oc_full_name: Optional[str] = None
    oc_other_name: Optional[str] = None
    oc_dob: Optional[str] = None  # DD/MM/YYYY
    oc_address: Optional[str] = None
    oc_city: Optional[str] = None
    oc_state: Optional[str] = None
    oc_postcode: Optional[str] = None
    oc_country: Optional[str] = None
    oc_postal_address: Optional[str] = None
    oc_postal_city: Optional[str] = None
    oc_postal_state: Optional[str] = None
    oc_postal_postcode: Optional[str] = None
    oc_postal_country: Optional[str] = None
    oc_phone: Optional[str] = None
    oc_email: Optional[str] = None
    oc_occupation: Optional[str] = None
    oc_abn: Optional[str] = None
    oc_acn: Optional[str] = None
    oc_arbn: Optional[str] = None
    oc_customer_number: Optional[str] = None
    oc_account_number: Optional[str] = None
    oc_business_structure: Optional[str] = None
    # ID (OUT only)
    oc_id1_type: Optional[str] = None
    oc_id1_type_other: Optional[str] = None
    oc_id1_number: Optional[str] = None
    oc_id1_issuer: Optional[str] = None
    oc_id2_type: Optional[str] = None
    oc_id2_type_other: Optional[str] = None
    oc_id2_number: Optional[str] = None
    oc_id2_issuer: Optional[str] = None
    oc_electronic_source: Optional[str] = None

    # Beneficiary customer
    bc_full_name: Optional[str] = None
    bc_dob: Optional[str] = None
    bc_business_name: Optional[str] = None
    bc_address: Optional[str] = None
    bc_city: Optional[str] = None
    bc_state: Optional[str] = None
    bc_postcode: Optional[str] = None
    bc_country: Optional[str] = None
    bc_postal_address: Optional[str] = None
    bc_postal_city: Optional[str] = None
    bc_postal_state: Optional[str] = None
    bc_postal_postcode: Optional[str] = None
    bc_postal_country: Optional[str] = None
    bc_phone: Optional[str] = None
    bc_email: Optional[str] = None
    bc_occupation: Optional[str] = None
    bc_abn: Optional[str] = None
    bc_acn: Optional[str] = None
    bc_arbn: Optional[str] = None
    bc_business_structure: Optional[str] = None
    bc_account_number: Optional[str] = None
    bc_institution_name: Optional[str] = None  # InstitutionWithAccount.name (MANDATORY)
    bc_institution_city: Optional[str] = None  # InstitutionWithAccount.city (MANDATORY)
    bc_institution_country: Optional[str] = None

    # Accept block
    retail_id_number: Optional[str] = None
    accept_full_name: Optional[str] = None
    accept_other_name: Optional[str] = None
    accept_dob: Optional[str] = None
    accept_address: Optional[str] = None
    accept_city: Optional[str] = None
    accept_state: Optional[str] = None
    accept_postcode: Optional[str] = None
    accept_country: Optional[str] = None
    accept_postal_address: Optional[str] = None
    accept_postal_city: Optional[str] = None
    accept_postal_state: Optional[str] = None
    accept_postal_postcode: Optional[str] = None
    accept_postal_country: Optional[str] = None
    accept_phone: Optional[str] = None
    accept_email: Optional[str] = None
    accept_occupation: Optional[str] = None
    accept_abn: Optional[str] = None
    accept_acn: Optional[str] = None
    # orderingInstn.foreignBased — MANDATORY per IFTI-DRA-1-2 schema
    # "Yes" if ordering institution is foreign-based, "No" if Australian
    accept_foreign_based: Optional[str] = "No"
    accept_business_structure: Optional[str] = None
    is_accepting_money: Optional[str] = "Yes"
    is_sending_instruction: Optional[str] = "Yes"

    diff_accept_full_name: Optional[str] = None
    diff_accept_address: Optional[str] = None
    diff_accept_city: Optional[str] = None
    diff_accept_state: Optional[str] = None
    diff_accept_postcode: Optional[str] = None
    diff_accept_country: Optional[str] = None

    # Send block
    send_full_name: Optional[str] = None
    send_other_name: Optional[str] = None
    send_dob: Optional[str] = None
    send_address: Optional[str] = None
    send_city: Optional[str] = None
    send_state: Optional[str] = None
    send_postcode: Optional[str] = None
    send_country: Optional[str] = None
    send_postal_address: Optional[str] = None
    send_postal_city: Optional[str] = None
    send_postal_state: Optional[str] = None
    send_postal_postcode: Optional[str] = None
    send_postal_country: Optional[str] = None
    send_phone: Optional[str] = None
    send_email: Optional[str] = None
    send_occupation: Optional[str] = None
    send_abn: Optional[str] = None
    send_acn: Optional[str] = None
    send_arbn: Optional[str] = None
    send_business_structure: Optional[str] = None

    # Receive block
    recv_full_name: Optional[str] = None
    recv_address: Optional[str] = None
    recv_city: Optional[str] = None
    recv_state: Optional[str] = None
    recv_postcode: Optional[str] = None
    recv_country: Optional[str] = None
    is_distributing: Optional[str] = "Yes"
    has_retail_outlet: Optional[str] = "No"

    # Distribute block
    dist_full_name: Optional[str] = None
    dist_address: Optional[str] = None
    dist_city: Optional[str] = None
    dist_state: Optional[str] = None
    dist_postcode: Optional[str] = None
    dist_country: Optional[str] = None

    # Retail outlet
    retail_full_name: Optional[str] = None
    retail_address: Optional[str] = None
    retail_city: Optional[str] = None
    retail_state: Optional[str] = None
    retail_postcode: Optional[str] = None
    retail_country: Optional[str] = None

    # initiatingInstn (optional intermediate institution — IFTI-DRA section 7.6)
    init_instn_same_as_ordering: Optional[str] = None  # Yes | No
    init_instn_full_name: Optional[str] = None
    init_instn_address: Optional[str] = None
    init_instn_city: Optional[str] = None
    init_instn_country: Optional[str] = None

    # Reason + reporter
    reason_for_transfer: Optional[str] = None
    reporter_full_name: Optional[str] = None
    reporter_job_title: Optional[str] = None
    reporter_phone: Optional[str] = None
    reporter_email: Optional[str] = None
    reporter_austrac_id: Optional[str] = None


class IFTIResponse(BaseModel):
    ifti_id: str
    direction: IFTIDirection
    status: IFTIStatus
    date_received: Optional[_date_type] = None
    date_available: Optional[_date_type] = None
    currency_code: Optional[str] = None
    total_amount: Optional[float] = None
    transfer_type: Optional[str] = None
    transaction_reference: Optional[str] = None
    oc_full_name: Optional[str] = None
    bc_full_name: Optional[str] = None
    reason_for_transfer: Optional[str] = None
    reporter_full_name: Optional[str] = None
    reporter_email: Optional[str] = None
    reporter_austrac_id: Optional[str] = None
    industry_id: Optional[str] = None
    created_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None
    submission_reference: Optional[str] = None
    submitted_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    due_date: Optional[_date_type] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("date_received", "date_available")
    def _fmt_date(self, v: Optional[_date_type]) -> Optional[str]:
        return v.strftime("%d/%m/%Y") if v else None
