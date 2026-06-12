from fastapi import APIRouter
from backend.services.product_master import get_product_types, get_product_subtypes

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/types")
def list_types():
    return get_product_types()


@router.get("/subtypes")
def list_subtypes(product_type: str = None):
    return get_product_subtypes(product_type)
