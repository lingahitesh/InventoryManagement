from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database.db import init_db
from backend.routers.inventory_router import router as inventory_router
from backend.routers.customer_router import router as customer_router
from backend.routers.order_router import router as order_router
from backend.routers.product_router import router as product_router
from backend.routers.dispatch_router import router as dispatch_router

app = FastAPI(title="Inventory Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    try:
        init_db()
    except Exception as e:
        print(f"[WARNING] DB init failed (tables may already exist or DB unreachable): {e}")

app.include_router(inventory_router)
app.include_router(customer_router)
app.include_router(order_router)
app.include_router(product_router)
app.include_router(dispatch_router)

@app.get("/")
def root():
    return {"status": "ok"}
