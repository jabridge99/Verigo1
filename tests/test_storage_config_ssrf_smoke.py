"""
Smoke test: storage_config_service.set_config() passed endpoint_url straight
into build_provider_from_config() (and ultimately boto3's endpoint_url),
which issues a live outbound connectivity-check request to that host before
the config is even saved. endpoint_url is attacker-controlled by any
Enterprise/VVIP tenant via PUT /storage/config, so it could be pointed at
the cloud metadata endpoint (169.254.169.254) or an internal service to
trigger SSRF. Fixed by validating endpoint_url (HTTPS-only, no
private/loopback/link-local/metadata hosts) before use, mirroring the
existing webhook URL validator.
"""

import pytest

from app.models.tenant import IndustryTenant
from app.schemas.storage import StorageConfigInput
from app.services import storage_config_service as svc


def _make_tenant(db, industry_id="org_storage_test") -> IndustryTenant:
    tenant = IndustryTenant(
        tenant_id=f"tn_{industry_id}",
        industry_id=industry_id,
        name="Storage Test Org",
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@pytest.mark.asyncio
async def test_set_config_rejects_ssrf_endpoint_url(db):
    tenant = _make_tenant(db)
    data = StorageConfigInput(
        backend="s3",
        bucket="b",
        access_key="ak",
        secret_key="sk",
        endpoint_url="http://169.254.169.254/",
    )
    with pytest.raises(ValueError):
        await svc.set_config(db, tenant.industry_id, data)


@pytest.mark.asyncio
async def test_set_config_rejects_private_ip_endpoint_url(db):
    tenant = _make_tenant(db, "org_storage_test2")
    data = StorageConfigInput(
        backend="s3",
        bucket="b",
        access_key="ak",
        secret_key="sk",
        endpoint_url="https://10.0.0.5/",
    )
    with pytest.raises(ValueError):
        await svc.set_config(db, tenant.industry_id, data)
