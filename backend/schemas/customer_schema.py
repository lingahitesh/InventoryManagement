from pydantic import BaseModel, Field, EmailStr

class CustomerCreate(BaseModel):

    fname: str
    mname: str = Field(default=None)
    lname: str
    contact: str
    email: EmailStr
    address: str
    pincode: int
    state: str
    city: str
    gst: str