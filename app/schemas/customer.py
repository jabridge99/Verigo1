from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.customer import CustomerStatus, IndustryType, RiskLevel


class CustomerCreate(BaseModel):
    full_name: str
    date_of_birth: str
    nationality: str
    country_of_residence: str
    id_number: str
    id_type: str
    address: str
    email: EmailStr
    phone: str
    industry: IndustryType
    occupation: Optional[str] = None
    source_of_funds: Optional[str] = None


class CustomerUpdate(BaseModel):
    address: Optional[str] = None
    phone: Optional[str] = None
    occupation: Optional[str] = None
    source_of_funds: Optional[str] = None
    status: Optional[CustomerStatus] = None


class CustomerResponse(BaseModel):
    id: int
    customer_id: str
    full_name: str
    date_of_birth: str
    nationality: str
    country_of_residence: str
    id_number: str
    id_type: str
    email: str
    phone: str
    industry: IndustryType
    occupation: Optional[str]
    source_of_funds: Optional[str]
    status: CustomerStatus
    risk_level: RiskLevel
    risk_score: float
    is_pep: int
    created_at: Optional[datetime]

    class Config:
        from_attributes = True
