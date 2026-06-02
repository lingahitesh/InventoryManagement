from pydantic import BaseModel
from datetime import date

class OrderItem(BaseModel):
    sku_id: int
    quantity: int
    price: float

class OrderCreate(BaseModel):
    customer_id: int
    items: list[OrderItem]
    order_date: date