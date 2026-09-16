from datetime import date
from typing import List, Optional

from pydantic import BaseModel

from app.models.board_report import BoardReportType, ReportPeriod


class ReportCreate(BaseModel):
    report_ref: str
    report_type: BoardReportType
    period: ReportPeriod
    period_start: date
    period_end: date
    title: Optional[str] = None
    executive_summary: Optional[str] = None
    mlro_commentary: Optional[str] = None
    key_messages: Optional[List[str]] = None


class ReportUpdate(BaseModel):
    title: Optional[str] = None
    executive_summary: Optional[str] = None
    mlro_commentary: Optional[str] = None
    key_messages: Optional[List[str]] = None
    board_minutes_ref: Optional[str] = None
    board_resolution: Optional[str] = None


class DistributeBody(BaseModel):
    distributed_to: List[str]  # e.g. ["Board", "Audit Committee", "CEO"]
    distribution_notes: Optional[str] = None
