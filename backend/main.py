from fastapi.middleware.cors import CORSMiddleware
from backend.database.db import init_db
from backend.routers.inventory_router import router as inventory_router
from backend.routers.customer_router import router as customer_router
from backend.routers.order_router import router as order_router
from backend.routers.product_router import router as product_router
from backend.routers.dispatch_router import router as dispatch_router
from backend.routers.payment_router import router as payment_router
from backend.routers.purchase_order_router import router as purchase_order_router
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        init_db()
    except Exception as e:
        print(f"[WARNING] DB init failed (tables may already exist or DB unreachable): {e}")
    yield

app = FastAPI(
    title="Inventory Management API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inventory_router)
app.include_router(customer_router)
app.include_router(order_router)
app.include_router(product_router)
app.include_router(dispatch_router)
app.include_router(payment_router)
app.include_router(purchase_order_router)

@app.get("/")
def root():
    return {"status": "ok"}
