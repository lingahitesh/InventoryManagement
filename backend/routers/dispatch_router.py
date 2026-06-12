from fastapi import APIRouter, HTTPException
from backend.services.dispatch_service import (
    create_dispatch, get_dispatches, get_dispatch_items, get_order_items_for_dispatch
)
from backend.schemas.dispatch_schema import DispatchCreate

router = APIRouter(prefix="/dispatches", tags=["dispatches"])


@router.post("")
def new_dispatch(body: DispatchCreate):
    dispatch_id = create_dispatch(
        body.tracking_id, body.dispatched_through, body.dispatch_doc_no,
        body.delivery_note_date, body.buyer_order_no, body.buyer_order_date,
        body.other_references, body.payment_mode, body.delivery_date, body.items
    )
    return {"message": "Dispatch created", "dispatch_id": dispatch_id}


@router.get("")
def list_dispatches():
    return get_dispatches()


@router.get("/{dispatch_id}/items")
def list_dispatch_items(dispatch_id: int):
    return get_dispatch_items(dispatch_id)


@router.get("/order-items/{order_id}")
def order_items_for_dispatch(order_id: int):
    """Get order items with remaining units available for dispatch."""
    return get_order_items_for_dispatch(order_id)
