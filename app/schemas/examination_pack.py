from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class GeneratePackRequest(BaseModel):
    period_start: date
    period_end: date
    sections: Optional[List[str]] = None  # null = all sections
    examiner_name: Optional[str] = None
    examiner_agency: str = "AUSTRAC"
    examination_ref: Optional[str] = None  # AUSTRAC's own reference number


class DeliverPackRequest(BaseModel):
    delivery_notes: Optional[str] = None
