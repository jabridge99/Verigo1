from typing import List, Optional

from pydantic import BaseModel

from app.models.ifti_e import IFTIEDirection, IFTIEMode


class IFTIECreate(BaseModel):
    direction: IFTIEDirection
    mode: IFTIEMode = IFTIEMode.structured
    date_received: str  # DD/MM/YYYY
    date_available: str  # DD/MM/YYYY
    currency_code: str = "AUD"
    total_amount: float
    transaction_reference: Optional[str] = None
    details_of_payment: Optional[str] = None  # max 140 chars
    sender_to_receiver_info: Optional[str] = None

    # Swift mode
    swift_msg: Optional[str] = None
    payer_same_as_swift_ord_cust: Optional[str] = None  # Yes/No

    # Payer
    payer_full_name: Optional[str] = None
    payer_other_name: Optional[str] = None
    payer_dob: Optional[str] = None  # DD/MM/YYYY
    payer_address: Optional[str] = None
    payer_city: Optional[str] = None
    payer_state: Optional[str] = None
    payer_postcode: Optional[str] = None
    payer_country: Optional[str] = None
    payer_postal_address: Optional[str] = None
    payer_postal_city: Optional[str] = None
    payer_postal_state: Optional[str] = None
    payer_postal_postcode: Optional[str] = None
    payer_postal_country: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[str] = None
    payer_occupation: Optional[str] = None
    payer_abn: Optional[str] = None
    payer_acn: Optional[str] = None
    payer_arbn: Optional[str] = None
    payer_account_number: Optional[str] = None
    payer_business_structure: Optional[str] = None
    payer_id1_type: Optional[str] = None
    payer_id1_number: Optional[str] = None
    payer_id1_issuer: Optional[str] = None
    payer_id2_type: Optional[str] = None
    payer_id2_number: Optional[str] = None
    payer_id2_issuer: Optional[str] = None
    payer_electronic_source: Optional[str] = None

    # Payer institution
    payer_instn_name: Optional[str] = None
    payer_instn_code: Optional[str] = None  # SWIFT BIC
    payer_instn_address: Optional[str] = None
    payer_instn_city: Optional[str] = None
    payer_instn_country: Optional[str] = None

    # Correspondent banks — [{name, code, address, city, country}]
    correspondent_instns: Optional[List[dict]] = None

    # Payee institution (MANDATORY in structured mode)
    payee_instn_name: Optional[str] = None
    payee_instn_code: Optional[str] = None  # SWIFT BIC
    payee_instn_address: Optional[str] = None
    payee_instn_city: Optional[str] = None
    payee_instn_country: Optional[str] = None  # MANDATORY

    # Payee
    payee_full_name: Optional[str] = None
    payee_dob: Optional[str] = None  # DD/MM/YYYY
    payee_business_name: Optional[str] = None
    payee_address: Optional[str] = None
    payee_city: Optional[str] = None
    payee_state: Optional[str] = None
    payee_postcode: Optional[str] = None
    payee_country: Optional[str] = None
    payee_phone: Optional[str] = None
    payee_email: Optional[str] = None
    payee_occupation: Optional[str] = None
    payee_abn: Optional[str] = None
    payee_acn: Optional[str] = None
    payee_arbn: Optional[str] = None
    payee_account_number: Optional[str] = None
    payee_account_iban: Optional[str] = None
    payee_business_structure: Optional[str] = None

    # Reporter
    reporter_full_name: Optional[str] = None
    reporter_job_title: Optional[str] = None
    reporter_phone: Optional[str] = None
    reporter_email: Optional[str] = None


class IFTIEUpdate(BaseModel):
    mode: Optional[IFTIEMode] = None
    date_received: Optional[str] = None
    date_available: Optional[str] = None
    currency_code: Optional[str] = None
    total_amount: Optional[float] = None
    transaction_reference: Optional[str] = None
    details_of_payment: Optional[str] = None
    sender_to_receiver_info: Optional[str] = None
    swift_msg: Optional[str] = None
    payer_same_as_swift_ord_cust: Optional[str] = None
    payer_full_name: Optional[str] = None
    payer_other_name: Optional[str] = None
    payer_dob: Optional[str] = None
    payer_address: Optional[str] = None
    payer_city: Optional[str] = None
    payer_state: Optional[str] = None
    payer_postcode: Optional[str] = None
    payer_country: Optional[str] = None
    payer_postal_address: Optional[str] = None
    payer_postal_city: Optional[str] = None
    payer_postal_state: Optional[str] = None
    payer_postal_postcode: Optional[str] = None
    payer_postal_country: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[str] = None
    payer_occupation: Optional[str] = None
    payer_abn: Optional[str] = None
    payer_acn: Optional[str] = None
    payer_arbn: Optional[str] = None
    payer_account_number: Optional[str] = None
    payer_business_structure: Optional[str] = None
    payer_id1_type: Optional[str] = None
    payer_id1_number: Optional[str] = None
    payer_id1_issuer: Optional[str] = None
    payer_id2_type: Optional[str] = None
    payer_id2_number: Optional[str] = None
    payer_id2_issuer: Optional[str] = None
    payer_electronic_source: Optional[str] = None
    payer_instn_name: Optional[str] = None
    payer_instn_code: Optional[str] = None
    payer_instn_address: Optional[str] = None
    payer_instn_city: Optional[str] = None
    payer_instn_country: Optional[str] = None
    correspondent_instns: Optional[List[dict]] = None
    payee_instn_name: Optional[str] = None
    payee_instn_code: Optional[str] = None
    payee_instn_address: Optional[str] = None
    payee_instn_city: Optional[str] = None
    payee_instn_country: Optional[str] = None
    payee_full_name: Optional[str] = None
    payee_dob: Optional[str] = None
    payee_business_name: Optional[str] = None
    payee_address: Optional[str] = None
    payee_city: Optional[str] = None
    payee_state: Optional[str] = None
    payee_postcode: Optional[str] = None
    payee_country: Optional[str] = None
    payee_phone: Optional[str] = None
    payee_email: Optional[str] = None
    payee_occupation: Optional[str] = None
    payee_abn: Optional[str] = None
    payee_acn: Optional[str] = None
    payee_arbn: Optional[str] = None
    payee_account_number: Optional[str] = None
    payee_account_iban: Optional[str] = None
    payee_business_structure: Optional[str] = None
    reporter_full_name: Optional[str] = None
    reporter_job_title: Optional[str] = None
    reporter_phone: Optional[str] = None
    reporter_email: Optional[str] = None
