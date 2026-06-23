from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from backend.services.purchase_order_service import (
    get_purchase_orders, get_purchase_order_items, create_purchase_order,
    delete_purchase_order, mark_item_arrived, get_billing_addresses,
    save_billing_address, COMPANY_SHIPPING_ADDRESSES, DEFAULT_BILLING
)

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


class POItem(BaseModel):
    sku_type:       str
    sku_subtype:    Optional[str] = None
    sku_dim:        Optional[str] = "-"
    sku_quantity:   float
    sku_units:      int = 1
    sku_cost_price: Optional[float] = None
    sku_desc:       Optional[str] = None


class POCreate(BaseModel):
    supplier_name:    str
    supplier_contact: Optional[str] = None
    supplier_gst:     Optional[str] = None
    supplier_email:   Optional[str] = None
    billing_address:  Optional[str] = None
    shipping_address: Optional[str] = None
    tracking_id:      Optional[str] = None
    order_date:       Optional[datetime] = None
    notes:            Optional[str] = None
    items:            List[POItem]


@router.get("")
def list_pos(status: str = None):
    return get_purchase_orders(status)


@router.post("")
def create_po(body: POCreate):
    po_id = create_purchase_order(
        body.supplier_name, body.supplier_contact, body.supplier_gst, body.supplier_email,
        body.billing_address or DEFAULT_BILLING, body.shipping_address,
        body.tracking_id, body.order_date, body.notes,
        [i.model_dump() for i in body.items]
    )
    return {"message": "Purchase order created", "po_id": po_id}


@router.get("/shipping-addresses")
def list_shipping_addresses():
    return {"addresses": COMPANY_SHIPPING_ADDRESSES}


@router.get("/billing-addresses")
def list_billing_addresses():
    return get_billing_addresses()


@router.post("/billing-addresses")
def add_billing_address(body: dict):
    address = body.get("address", "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="Address required")
    save_billing_address(address)
    return {"message": "Saved"}


@router.get("/{po_id}/items")
def list_po_items(po_id: int):
    return get_purchase_order_items(po_id)


@router.delete("/{po_id}")
def delete_po(po_id: int):
    rows = delete_purchase_order(po_id)
    if rows == 0:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return {"message": "Deleted"}


@router.post("/items/{poi_id}/arrived")
def toggle_arrived(poi_id: int, body: dict):
    arrived = bool(body.get("arrived", True))
    return mark_item_arrived(poi_id, arrived)
