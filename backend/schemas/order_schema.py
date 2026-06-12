from pydantic import BaseModel
from datetime import datetime


class CartLine(BaseModel):
    sku_type:      str
    sku_subtype:   str
    sku_dim:       str
    quantity:      float
    selling_price: float


class OrderCreate(BaseModel):
    customer_id:      int
    order_date:       datetime
    shipping_address: str
    total_units:      int
    total_qty:        float
    total_amount:     float
    lines:            list[CartLine]
