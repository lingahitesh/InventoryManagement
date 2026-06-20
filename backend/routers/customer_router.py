from fastapi import APIRouter, HTTPException
from backend.services.customer_service import (
    add_customer,
    get_customers,
    update_customer,
    delete_customer,
    get_shipping_addresses,
    set_customer_shipping_addresses
)
from backend.schemas.customer_schema import CustomerCreate

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("")
def fetch_customers():
    return get_customers()


@router.get("/{customer_id}/shipping-addresses")
def fetch_shipping_addresses(customer_id: int):
    return get_shipping_addresses(customer_id)


@router.put("/{customer_id}/shipping-addresses")
def update_shipping_addresses(customer_id: int, addresses: list[dict]):
    set_customer_shipping_addresses(customer_id, addresses)
    return {"message": "Shipping addresses updated"}


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
    # If shipping addresses provided, get the new customer_id and save them
    if customer.shipping_addresses:
        customers = get_customers()
        new_cust = customers[-1] if customers else None
        if new_cust:
            set_customer_shipping_addresses(
                new_cust["customer_id"],
                [a.model_dump() for a in customer.shipping_addresses]
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
    # Update shipping addresses if provided
    if customer.shipping_addresses is not None:
        set_customer_shipping_addresses(
            customer_id,
            [a.model_dump() for a in customer.shipping_addresses]
        )
    return {"message": "Customer Updated"}


@router.delete("/{customer_id}")
def remove_customer(customer_id: int):
    rows_affected = delete_customer(customer_id)
    if rows_affected == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer Deleted"}
