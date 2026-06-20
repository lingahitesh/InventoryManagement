from fastapi import APIRouter, HTTPException
from backend.services.order_service import (
    allocate_and_place_order, get_orders, get_order_items,
    get_order_full, delete_order,
)
from backend.schemas.order_schema import OrderCreate

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("")
def place_order(order: OrderCreate):
    order_id = allocate_and_place_order(
        order.customer_id, order.order_date, order.shipping_address,
        order.total_units, order.total_qty, order.total_amount,
        order.delivery_charge, order.lines
    )
    return {"message": "Order Placed", "order_id": order_id}


@router.get("")
def fetch_orders():
    return get_orders()


@router.get("/{order_id}/items")
def fetch_order_items(order_id: int):
    return get_order_items(order_id)


@router.get("/{order_id}/invoice")
def download_invoice(order_id: int):
    from fastapi.responses import Response
    from backend.services.invoice_service import generate_invoice_pdf
    try:
        pdf_bytes = generate_invoice_pdf(order_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Order not found")
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=PI_{order_id}.pdf"}
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
