from pydantic import BaseModel
from typing import List, Optional

class RegulationItem(BaseModel):
    control_id: str
    text: str
    modal_verb: Optional[str] = None
    severity: str  # High, Medium, Low, Unknown
    score: int = 0  # 0-100 risk score
    category: str = "LOW"  # CRITICAL, HIGH, MEDIUM, LOW
    score_reasons: List[str] = []  # human-readable reasons for scoring
    score_flags: dict = {}  # {penalty: bool, mandatory: bool, breach: bool, enforcement: bool}
    action: str = "Review"

class ParsingResult(BaseModel):
    filename: str
    total_items: int
    items: List[RegulationItem]
