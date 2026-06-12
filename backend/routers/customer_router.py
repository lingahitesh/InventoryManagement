from fastapi import APIRouter, HTTPException
from backend.services.customer_service import (
    add_customer,
    get_customers,
    update_customer,
    delete_customer
)
from backend.schemas.customer_schema import CustomerCreate

router = APIRouter(prefix="/customers", tags=["customers"])

KEYS = [
    "customer_id", "fname", "mname", "lname",
    "contact", "email", "address", "pincode",
    "city", "state", "gst"
]


def row_to_dict(row):
    return dict(zip(KEYS, row))


@router.get("")
def fetch_customers():
    rows = get_customers()
    return [row_to_dict(r) for r in rows]


@router.post("")
def create_customer(customer: CustomerCreate):
    add_customer(
        customer.fname,
        customer.mname,
        customer.lname,
        customer.contact,
        customer.email,
        customer.address,
        customer.pincode,
        customer.state,
        customer.city,
        customer.gst
    )
    return {"message": "Customer Added"}


@router.put("/{customer_id}")
def edit_customer(customer_id: int, customer: CustomerCreate):
    rows_affected = update_customer(
        customer_id,
        customer.fname,
        customer.mname,
        customer.lname,
        customer.contact,
        customer.email,
        customer.address,
        customer.pincode,
        customer.state,
        customer.city,
        customer.gst
    )
    if rows_affected == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer Updated"}


@router.delete("/{customer_id}")
def remove_customer(customer_id: int):
    rows_affected = delete_customer(customer_id)
    if rows_affected == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer Deleted"}
