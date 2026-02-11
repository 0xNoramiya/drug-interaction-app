from pydantic import BaseModel
from typing import List, Optional

class Drug(BaseModel):
    id: int
    name: str

class Interaction(BaseModel):
    drug_a: str
    drug_b: str
    description: str

class InteractionCheckRequest(BaseModel):
    drugs: List[str]

class InteractionResponse(BaseModel):
    interactions: List[Interaction]
