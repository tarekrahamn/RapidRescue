from pydantic import BaseModel, Field
from typing import Optional
import re
from pydantic import BaseModel, EmailStr, field_validator

class SignupRequest(BaseModel):
    """
    Schema for user signup.
    Ensures only valid Bangladeshi mobile numbers and Gmail addresses are allowed.
    Validates password length and user type.
    """
    name: str
    mobile: str
    email: EmailStr
    password: str
    user_type: str

    @field_validator("mobile")
    def validate_mobile(cls, mobile: str) -> str:
        """
        Validates Bangladeshi phone numbers:
        Must start with +880 or 01 and be followed by 9 digits.
        """
        pattern = r"^(\+8801[3-9]\d{8}|01[3-9]\d{8})$"
        if not re.fullmatch(pattern, mobile):
            raise ValueError(
                "Invalid Bangladeshi phone number format. "
                "Example: +88017XXXXXXXX or 017XXXXXXXX"
            )
        return mobile

    @field_validator("email")
    def validate_google_email(cls, email: str) -> str:
        """
        Ensures only Google (Gmail) email addresses are allowed.
        """
        if not email.endswith("@gmail.com"):
            raise ValueError(
                "Only Google email addresses (@gmail.com) are allowed for signup"
            )
        return email

    @field_validator("password")
    def validate_password(cls, password: str) -> str:
        """
        Ensures password is at least 6 characters long.
        """
        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters long")
        return password

    @field_validator("user_type")
    def validate_user_type(cls, user_type: str) -> str:
        """
        Ensures user_type is either 'rider' or 'driver'.
        """
        if user_type not in ["rider", "driver"]:
            raise ValueError("User type must be either 'rider' or 'driver'")
        return user_type

class LoginRequest(BaseModel):
    """
    Schema for user login.
    Allows either phone number or email for login.
    Validates password length and user type.
    """
    phone_or_email: str
    password: str
    user_type: str

    @field_validator("user_type")
    def validate_user_type(cls, user_type: str) -> str:
        """
        Ensures user_type is either 'rider' or 'driver'.
        """
        if user_type not in ["rider", "driver"]:
            raise ValueError("User type must be either 'rider' or 'driver'")
        return user_type

# Response Models
class SignupResponse(BaseModel):
    """
    Response schema for successful signup.
    """
    success: bool
    message: str

class LoginResponse(BaseModel):
    """
    Response schema for successful login.
    """
    success: bool
    name: str
    id: int
    role: str
    mobile: str
    email: str
    token: str

class ErrorResponse(BaseModel):
    """
    Response schema for errors.
    """
    detail: str

class TokenData(BaseModel):
    """
    Schema for token data payload.
    """
    sub: str
    email: str
    mobile: str
    role: str
    name: str

class DriverLocationCreate(BaseModel):
    """
    Schemas for driver location and nearby drivers.
    Validates latitude and longitude ranges.
    """
    driver_id: int
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)

class DriverLocationResponse(BaseModel):
    """
    Response schema for driver location.
    """
    driver_id: int
    name: str
    mobile: str


class NearbyDriversRequest(BaseModel):
    """
    Request schema for finding nearby drivers.
    Validates latitude, longitude, and radius.
    """
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    radius: float = Field(..., gt=0)  # radius in kilometers


class Coordinates(BaseModel):
    """
    Base model for geographical coordinates.
    Validates latitude and longitude ranges.
    """
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class BaseDriverLocationRequest(Coordinates):
    """
    Base model for driver location requests.
    """
    driver_id: int

class LocationUpdateResponse(BaseModel):
    success: bool

class LocationAddResponse(BaseModel):
    """
    Response schema for adding or updating driver location.
    """
    success: bool
    message: Optional[str] = None

class LocationRemoveResponse(BaseModel):
    """
    Response schema for removing driver location.
    """
    success: bool
    message: Optional[str] = None


class UpdateDriverLocationRequest(BaseDriverLocationRequest):
    pass

class AddDriverLocationRequest(BaseDriverLocationRequest):
    pass

class LocationGetResponse(Coordinates):
    pass
