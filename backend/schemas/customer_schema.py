from typing import Optional, List
from pydantic import BaseModel


class ShippingAddress(BaseModel):
    address:    str
    pincode:    int
    city:       str
    state:      str
    is_default: bool = False


class CustomerCreate(BaseModel):
    fname:    str
    mname:    Optional[str] = None
    lname:    str
    contact:  str           # comma-separated if multiple
    email:    str           # comma-separated if multiple
    address:  str           # billing address
    pincode:  int
    state:    str
    city:     str
    gst:      str
    shipping_addresses: List[ShippingAddress]
