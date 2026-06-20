from fastapi import APIRouter, HTTPException
from backend.services.dispatch_service import (
    create_dispatch, get_dispatches, get_dispatch_items, get_order_items_for_dispatch, delete_dispatch
)
from backend.schemas.dispatch_schema import DispatchCreate

router = APIRouter(prefix="/dispatches", tags=["dispatches"])


@router.post("")
def new_dispatch(body: DispatchCreate):
    dispatch_id = create_dispatch(body.dispatched_through, body.items)
    return {"message": "Dispatch created", "dispatch_id": dispatch_id}


@router.get("")
def list_dispatches():
    return get_dispatches()


@router.get("/{dispatch_id}/items")
def list_dispatch_items(dispatch_id: int):
    return get_dispatch_items(dispatch_id)


@router.get("/order-items/{order_id}")
def order_items_for_dispatch(order_id: int):
    return get_order_items_for_dispatch(order_id)


@router.delete("/{dispatch_id}")
def remove_dispatch(dispatch_id: int):
    rows = delete_dispatch(dispatch_id)
    if rows == 0:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return {"message": "Dispatch deleted"}
