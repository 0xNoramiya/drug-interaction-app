import re
from typing import List, Optional

from pydantic import BaseModel, Field, constr, validator

class Drug(BaseModel):
    id: int
    name: str

class Interaction(BaseModel):
    drug_a: str
    drug_b: str
    description: str

class InteractionCheckRequest(BaseModel):
    drugs: List[str]

    @validator("drugs")
    def validate_drug_list(cls, value):
        if len(value) < 2:
            raise ValueError("At least 2 drugs are required")
        if len(value) > 25:
            raise ValueError("A maximum of 25 drugs is allowed per request")
        return value

    @validator("drugs", each_item=True)
    def validate_drug_name(cls, value):
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Drug names cannot be empty")
        if len(cleaned) > 200:
            raise ValueError("Drug name is too long")
        return cleaned


class QuotaStatus(BaseModel):
    is_premium: bool
    daily_limit: Optional[int]
    used_today: int
    remaining_today: Optional[int]

class InteractionResponse(BaseModel):
    interactions: List[Interaction]
    quota: QuotaStatus


IDENTIFIER_REGEX = re.compile(r"^[a-zA-Z0-9._@+-]+$")


def normalize_identifier(value: str) -> str:
    normalized = value.strip().lower()
    if len(normalized) < 3:
        raise ValueError("Email or username must be at least 3 characters")
    if len(normalized) > 120:
        raise ValueError("Email or username is too long")
    if not IDENTIFIER_REGEX.match(normalized):
        raise ValueError("Email or username contains invalid characters")
    return normalized


class RegisterRequest(BaseModel):
    email: constr(strip_whitespace=True, min_length=3, max_length=120)
    password: constr(min_length=8, max_length=128)

    @validator("email")
    def validate_email(cls, value):
        return normalize_identifier(value)

    @validator("password")
    def validate_password_strength(cls, value):
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must include a lowercase letter")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must include an uppercase letter")
        if not re.search(r"[0-9]", value):
            raise ValueError("Password must include a number")
        return value


class LoginRequest(BaseModel):
    email: constr(strip_whitespace=True, min_length=3, max_length=120)
    password: constr(min_length=8, max_length=128)

    @validator("email")
    def validate_email(cls, value):
        return normalize_identifier(value)


class UserProfile(BaseModel):
    id: int
    email: str
    is_admin: bool
    is_premium: bool
    is_active: bool
    created_at: int


class AuthResponse(BaseModel):
    token: Optional[str] = None
    user: UserProfile
    quota: QuotaStatus


class MeResponse(BaseModel):
    user: UserProfile
    quota: QuotaStatus


class MessageResponse(BaseModel):
    message: str


class PremiumRequestCreate(BaseModel):
    note: Optional[constr(strip_whitespace=True, max_length=500)] = None


class PremiumRequestResponse(BaseModel):
    id: int
    user_id: int
    user_email: str
    status: str
    note: Optional[str]
    created_at: int
    reviewed_at: Optional[int]
    reviewed_by: Optional[int]
    reviewed_by_email: Optional[str]


class AdminSetPremiumRequest(BaseModel):
    is_premium: bool = Field(..., description="Set true to activate premium, false to deactivate")


class AdminPremiumDecisionRequest(BaseModel):
    note: Optional[constr(strip_whitespace=True, max_length=500)] = None


class AdminUserResponse(BaseModel):
    id: int
    email: str
    is_admin: bool
    is_premium: bool
    is_active: bool
    created_at: int
    checks_today: int
