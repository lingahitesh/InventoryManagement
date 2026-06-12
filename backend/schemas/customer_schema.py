from typing import Optional
from pydantic import BaseModel, Field, EmailStr

class CustomerCreate(BaseModel):

    fname: str
    mname: Optional[str] = None
    lname: str
    contact: str
    email: EmailStr
    address: str
    pincode: int
    state: str
    city: str
    gst: str