from pydantic import BaseModel
from typing import Optional
from datetime import date


class DispatchItem(BaseModel):
    order_id:         int
    order_item_id:    int
    units_dispatched: int


class DispatchCreate(BaseModel):
    tracking_id:        str
    dispatched_through: str
    dispatch_doc_no:    Optional[str] = None
    delivery_note_date: Optional[date] = None
    buyer_order_no:     Optional[str] = None
    buyer_order_date:   Optional[date] = None
    other_references:   Optional[str] = None
    payment_mode:       str
    delivery_date:      Optional[date] = None
    items:              list[DispatchItem]
