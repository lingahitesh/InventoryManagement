from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class InventoryCreate(BaseModel):
    sku_type:       str
    sku_subtype:    str
    sku_dim:        str
    sku_quantity:   float
    sku_desc:       Optional[str]      = None
    sku_units:      int
    sku_cost_price: float
    tracking_id:    Optional[str]      = None
    entry_date:     Optional[datetime] = None   # full timestamp; defaults to now()


class InventoryUpdate(BaseModel):
    sku_type:       str
    sku_subtype:    str
    sku_dim:        str
    sku_quantity:   float
    sku_desc:       Optional[str]      = None
    sku_units:      int
    sku_cost_price: float
    tracking_id:    Optional[str]      = None
    entry_date:     Optional[datetime] = None
