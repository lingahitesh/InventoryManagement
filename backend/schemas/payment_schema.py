from pydantic import BaseModel
from typing import Optional
from datetime import date


class PaymentCreate(BaseModel):
    customer_id:  int
    amt_paid:     float
    payment_date: date
    order_id:     Optional[int] = None
    notes:        Optional[str] = None
