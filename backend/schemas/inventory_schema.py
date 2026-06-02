from pydantic import BaseModel, Field

class InventoryCreate(BaseModel):
    sku_type: str
    sku_subtype: str
    sku_dim: str
    sku_quantity: float
    sku_desc: str = Field(default=None)
    sku_units: int
    sku_cost_price: float