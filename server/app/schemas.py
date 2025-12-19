from pydantic import BaseModel
from typing import List, Optional

class RegulationItem(BaseModel):
    control_id: str
    text: str
    modal_verb: Optional[str] = None
    severity: str  # High, Medium, Low, Unknown
    action: str = "Review"

class ParsingResult(BaseModel):
    filename: str
    total_items: int
    items: List[RegulationItem]
