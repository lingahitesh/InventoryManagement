from fastapi import APIRouter, HTTPException
from backend.services.inventory_service import (
    add_inventory, get_inventory, search_inventory,
    get_inventory_summary, get_matching_skus,
    update_inventory, delete_inventory, get_next_sku_id
)
from backend.schemas.inventory_schema import InventoryCreate, InventoryUpdate

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.post("")
def create_inventory(inv: InventoryCreate):
    new_id = add_inventory(
        inv.sku_type, inv.sku_subtype, inv.sku_dim,
        inv.sku_quantity, inv.sku_cost_price, inv.sku_desc, inv.sku_units,
        inv.tracking_id, inv.entry_date, inv.location
    )
    return {"message": "Inventory Added", "sku_id": new_id}


@router.get("")
def fetch_inventory():
    return get_inventory()


@router.get("/next-id")
def next_sku_id():
    return {"next_sku_id": get_next_sku_id()}


@router.get("/search")
def search_inventory_api(
    sku_type:       str   = None,
    sku_subtype:    str   = None,
    sku_dim:        str   = None,
    tracking_id:    str   = None,
    cost_price_min: float = None,
    cost_price_max: float = None,
    date_from:      str   = None,
    date_to:        str   = None
):
    return search_inventory(sku_type, sku_subtype, sku_dim, tracking_id,
                            cost_price_min, cost_price_max, date_from, date_to)


@router.get("/summary")
def inventory_summary(
    sku_type:       str   = None,
    sku_subtype:    str   = None,
    sku_dim:        str   = None,
    tracking_id:    str   = None,
    cost_price_min: float = None,
    cost_price_max: float = None,
    date_from:      str   = None,
    date_to:        str   = None
):
    return get_inventory_summary(sku_type, sku_subtype, sku_dim, tracking_id,
                                 cost_price_min, cost_price_max, date_from, date_to)


@router.get("/available")
def check_availability(sku_type: str, sku_subtype: str, sku_dim: str):
    """Returns matching SKUs plus total_available (kg) and total_units."""
    skus        = get_matching_skus(sku_type, sku_subtype, sku_dim)
    total_qty   = sum(float(s["sku_quantity"])*int(s["sku_units"]) for s in skus)
    total_units = sum(int(s["sku_units"] or 0) for s in skus)
    return {"skus": skus, "total_available": total_qty, "total_units": total_units}


@router.put("/{sku_id}")
def edit_inventory(sku_id: int, inv: InventoryUpdate):
    rows = update_inventory(
        sku_id,
        inv.sku_type, inv.sku_subtype, inv.sku_dim,
        inv.sku_quantity, inv.sku_cost_price, inv.sku_desc, inv.sku_units,
        inv.tracking_id, inv.entry_date, inv.location
    )
    if rows == 0:
        raise HTTPException(status_code=404, detail="SKU not found")
    return {"message": "Inventory Updated"}


@router.delete("/{sku_id}")
def remove_inventory(sku_id: int):
    rows = delete_inventory(sku_id)
    if rows == 0:
        raise HTTPException(status_code=404, detail="SKU not found")
    return {"message": "Inventory Deleted"}


@router.get("/price-history")
def price_history(sku_type: str, sku_subtype: str, sku_dim: str, customer_id: int = None):
    """Get min/max/avg selling price over last 3 months and last 3 prices for a customer."""
    from backend.services.inventory_service import get_price_history
    return get_price_history(sku_type, sku_subtype, sku_dim, customer_id)
