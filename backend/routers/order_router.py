from fastapi import APIRouter, HTTPException
from backend.services.order_service import (
    allocate_and_place_order, get_orders, get_order_items,
    get_order_full, delete_order, toggle_order_item_ready,
)
from backend.services.dashboard_service import get_dashboard_data
from backend.schemas.order_schema import OrderCreate

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("/dashboard")
def dashboard():
    return get_dashboard_data()


@router.post("")
def place_order(order: OrderCreate):
    order_id = allocate_and_place_order(
        order.customer_id, order.order_date, order.shipping_address,
        order.total_units, order.total_qty, order.total_amount,
        order.delivery_charge, order.terms_of_payment, order.lines
    )
    return {"message": "Order Placed", "order_id": order_id}


@router.get("")
def fetch_orders():
    return get_orders()


@router.get("/{order_id}/items")
def fetch_order_items(order_id: int):
    return get_order_items(order_id)


@router.get("/{order_id}/invoice")
def download_invoice(order_id: int, item_ids: str = None, no_delivery: str = None):
    from fastapi.responses import Response
    from backend.services.invoice_service import generate_invoice_pdf
    try:
        ids_list = [int(x) for x in item_ids.split(",") if x.strip()] if item_ids else None
        include_delivery = no_delivery != "1"
        pdf_bytes = generate_invoice_pdf(order_id, item_ids=ids_list, include_delivery=include_delivery)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Order not found")
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=PI_{order_id}.pdf"}
    )


@router.get("/{order_id}")
def fetch_order_full(order_id: int):
    order = get_order_full(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.delete("/{order_id}")
def remove_order(order_id: int):
    rows = delete_order(order_id)
    if rows == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted and inventory restored"}


@router.post("/{order_id}/items/{item_id}/ready")
def set_item_ready(order_id: int, item_id: int, body: dict):
    toggle_order_item_ready(item_id, body.get("is_ready", True))
    return {"message": "Updated"}
