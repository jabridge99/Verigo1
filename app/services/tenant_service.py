import uuid
from sqlalchemy.orm import Session
from app.models.tenant import IndustryTenant
from app.schemas.tenant import TenantCreate, TenantUpdate


def create_tenant(db: Session, payload: TenantCreate) -> IndustryTenant:
    tenant = IndustryTenant(tenant_id=f"TENANT-{uuid.uuid4().hex[:10].upper()}", **payload.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def get_tenant(db: Session, tenant_id: str):
    return db.query(IndustryTenant).filter_by(tenant_id=tenant_id).first()


def get_tenant_by_industry(db: Session, industry_id: str):
    return db.query(IndustryTenant).filter_by(industry_id=industry_id).first()


def list_tenants(db: Session, status=None, skip: int = 0, limit: int = 100):
    q = db.query(IndustryTenant)
    if status:
        q = q.filter(IndustryTenant.status == status)
    return q.order_by(IndustryTenant.created_at.desc()).offset(skip).limit(limit).all()


def update_tenant(db: Session, tenant_id: str, payload: TenantUpdate):
    tenant = get_tenant(db, tenant_id)
    if not tenant:
        return None
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(tenant, k, v)
    db.commit()
    db.refresh(tenant)
    return tenant


def suspend_tenant(db: Session, tenant_id: str):
    return update_tenant(db, tenant_id, TenantUpdate(status="suspended"))


def activate_tenant(db: Session, tenant_id: str):
    return update_tenant(db, tenant_id, TenantUpdate(status="active"))


def tenant_stats(db: Session) -> dict:
    total     = db.query(IndustryTenant).count()
    active    = db.query(IndustryTenant).filter_by(status="active").count()
    suspended = db.query(IndustryTenant).filter_by(status="suspended").count()
    pending   = db.query(IndustryTenant).filter_by(status="pending").count()
    return {"total": total, "active": active, "suspended": suspended, "pending": pending}
