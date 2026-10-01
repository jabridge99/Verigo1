from typing import List, Optional

from pydantic import BaseModel

from app.models.customer_portal import PortalType


class QuestionnaireResponseRequest(BaseModel):
    responses: dict
    mark_complete: bool = False


class CreatePortalSessionRequest(BaseModel):
    customer_id: str
    portal_type: PortalType = PortalType.cdd
    required_documents: List[str] = ["passport", "proof_of_address"]
    required_questionnaire_sections: List[str] = ["cdd_personal"]
    expiry_days: int = 7


class ReviewDocumentRequest(BaseModel):
    accepted: bool
    rejection_reason: Optional[str] = None
