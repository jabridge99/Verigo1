"""
Regression test for a confirmed bug in
app/api/routes/customer_workflow.py's _transition(): it constructed
CustomerWorkflowEvent(metadata=metadata or {}). `metadata` isn't a real
column on the model (the real one is event_metadata) but IS a valid
attribute name on every SQLAlchemy declarative class (the class's
MetaData object, inherited from Base) -- so the default declarative
constructor's `setattr(self, k, v)` doesn't raise, it just shadows that
class attribute on the one in-memory instance, and the value is never
part of the mapped state that gets written to the database.

The practical effect: GET /events -- which loads CustomerWorkflowEvent
rows fresh via a new query rather than reusing the just-constructed
instance -- reads `.metadata` back on those freshly-loaded rows and gets
the class-level SQLAlchemy MetaData object (since nothing shadows it on
a freshly-hydrated instance), not the dict that was meant to be stored.
WorkflowEventResponse.metadata is typed Optional[Dict[str, Any]], so
pydantic fails to validate a MetaData object against it -- confirmed via
mypy once the SQLAlchemy plugin was enabled ("Unexpected keyword
argument 'metadata' for CustomerWorkflowEvent").
"""

from app.models.customer import Customer, CustomerStatus, CustomerType
from tests.conftest import _auth


def _make_customer(db, org_id: str) -> Customer:
    customer = Customer(
        customer_ref="CUST-WF-0002",
        org_id=org_id,
        full_name="Workflow Test Customer",
        customer_type=CustomerType.individual,
        status=CustomerStatus.draft,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def test_workflow_events_list_serialises_after_transition(client, admin_user, db):
    customer = _make_customer(db, admin_user.org_id)

    start = client.post(
        f"/api/v1/customers/{customer.id}/workflow/start",
        params={"comments": "kicking off data collection"},
        headers=_auth(admin_user),
    )
    assert start.status_code == 200, start.text

    events = client.get(
        f"/api/v1/customers/{customer.id}/workflow/events",
        headers=_auth(admin_user),
    )
    assert events.status_code == 200, events.text
    body = events.json()
    assert len(body) == 1
    assert body[0]["action"] == "start_collection"
    assert body[0]["comments"] == "kicking off data collection"
