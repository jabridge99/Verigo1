from typing import Optional

from pydantic import BaseModel, Field

from app.models.risk_matrix import QuestionAnswer, QuestionContext


class MonitoringConfigUpdate(BaseModel):
    # Alert score weights — must sum to 1.0 if all provided
    behaviour_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    rule_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    customer_risk_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    risk_matrix_weight: Optional[float] = Field(None, ge=0.0, le=1.0)

    # Custom question weight (0% – 40% of final approval score)
    custom_question_weight: Optional[float] = Field(None, ge=0.0, le=0.40)

    # Risk matrix dimension weights — must sum to 1.0 if all provided
    matrix_customer_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    matrix_geographic_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    matrix_product_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    matrix_transaction_weight: Optional[float] = Field(None, ge=0.0, le=1.0)


class ApprovalQuestionCreate(BaseModel):
    question_text: str = Field(..., min_length=10, max_length=500)
    question_order: int = Field(default=1, ge=1, le=5)
    is_required: bool = True
    industry_context: Optional[str] = Field(None, max_length=200)
    help_text: Optional[str] = Field(None, max_length=500)
    context: QuestionContext = QuestionContext.transaction


class ApprovalQuestionUpdate(BaseModel):
    question_text: Optional[str] = Field(None, min_length=10, max_length=500)
    question_order: Optional[int] = Field(None, ge=1, le=5)
    is_required: Optional[bool] = None
    industry_context: Optional[str] = Field(None, max_length=200)
    help_text: Optional[str] = Field(None, max_length=500)


class QuestionAnswerItem(BaseModel):
    question_id: str
    answer: QuestionAnswer
    notes: Optional[str] = None


class AnswerQuestionsRequest(BaseModel):
    answers: list[QuestionAnswerItem]


class CustomerQuestionAnswerItem(BaseModel):
    question_id: str
    answer: QuestionAnswer
    notes: Optional[str] = None


class CustomerAnswerQuestionsRequest(BaseModel):
    answers: list[CustomerQuestionAnswerItem]
