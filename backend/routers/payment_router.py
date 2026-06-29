from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from backend.services.payment_service import (
    get_payments, add_payment, update_payment, delete_payment, get_customer_balance
)
from backend.services.ledger_service import generate_ledger_pdf
from backend.services.dues_service import get_customer_dues_summary, get_customer_dues_detail, get_order_items_breakdown
from backend.schemas.payment_schema import PaymentCreate

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("")
def list_payments(
    customer_id: int   = None,
    date_from:   str   = None,
    date_to:     str   = None,
    amt_min:     float = None,
    amt_max:     float = None,
):
    return get_payments(customer_id, date_from, date_to, amt_min, amt_max)


@router.post("")
def create_payment(body: PaymentCreate):
    add_payment(body.customer_id, body.amt_paid, body.payment_date, body.order_id, body.notes)
    return {"message": "Payment recorded"}


# ── Specific sub-paths MUST come before /{payment_id} to avoid shadowing ──

@router.get("/balance/{customer_id}")
def customer_balance(customer_id: int):
    return get_customer_balance(customer_id)


@router.get("/dues")
def list_dues():
    """Get all customers with outstanding dues."""
    return get_customer_dues_summary()


@router.get("/dues/{customer_id}")
def customer_dues_detail(customer_id: int):
    """Get order-level dues breakdown for a customer."""
    return get_customer_dues_detail(customer_id)


@router.get("/dues/{customer_id}/order/{order_id}/items")
def order_items_for_dues(customer_id: int, order_id: int):
    """Get item-level breakdown for a specific order."""
    return get_order_items_breakdown(order_id)


@router.get("/ledger/{customer_id}")
def download_ledger(customer_id: int, date_from: str, date_to: str):
    pdf_bytes = generate_ledger_pdf(customer_id, date_from, date_to)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=Ledger_{customer_id}.pdf"}
    )


@router.put("/{payment_id}")
def edit_payment(payment_id: int, body: PaymentCreate):
    rows = update_payment(payment_id, body.amt_paid, body.payment_date, body.order_id, body.notes)
    if rows == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Payment updated"}


@router.delete("/{payment_id}")
def remove_payment(payment_id: int):
    rows = delete_payment(payment_id)
    if rows == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Payment deleted"}
