from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.db.database import get_db
from app.models.customer import Customer, CustomerStatus
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.services.risk_scoring import score_customer, score_to_level
from app.services.sanctions_screening import screen_name

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("/", response_model=CustomerResponse, status_code=201)
def onboard_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Customer with this email already exists")
    customer = Customer(customer_id=f"CUST-{uuid.uuid4().hex[:10].upper()}", **payload.model_dump())
    sanctions = screen_name(payload.full_name)
    if sanctions["match_found"]:
        customer.status = CustomerStatus.suspended
        customer.risk_score = 100.0
        customer.risk_level = "critical"
    else:
        risk_score = score_customer(customer)
        customer.risk_score = risk_score
        customer.risk_level = score_to_level(risk_score)
        customer.status = CustomerStatus.pending
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/", response_model=List[CustomerResponse])
def list_customers(skip: int = 0, limit: int = 50, status: str = None, risk_level: str = None, db: Session = Depends(get_db)):
    query = db.query(Customer)
    if status:
        query = query.filter(Customer.status == status)
    if risk_level:
        query = query.filter(Customer.risk_level == risk_level)
    return query.offset(skip).limit(limit).all()


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: str, payload: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer
