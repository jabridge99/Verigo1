from pydantic import BaseModel


class ActionRequest(BaseModel):
    action_taken: str


class DismissRequest(BaseModel):
    dismissed_reason: str
