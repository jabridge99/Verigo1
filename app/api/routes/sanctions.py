from fastapi import APIRouter
from pydantic import BaseModel

from app.services.sanctions_screening import screen_name

router = APIRouter(prefix="/sanctions", tags=["Sanctions Screening"])


class ScreenRequest(BaseModel):
    name: str


@router.post("/screen")
def screen(payload: ScreenRequest):
    return screen_name(payload.name)
