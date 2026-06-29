"""Generates a Purchase Order PDF for a given PO."""
from fpdf import FPDF
from datetime import datetime
from backend.services.purchase_order_service import get_purchase_order_items
from backend.database.db import get_db


COMPANY_INFO = {
    "name": "CHAMPA POLYPLAST PVT. LTD.",
    "address": "3/B, PORTUGESE CHURCH STREET, KOLKATA-700001",
    "pan": "AAHCC4947L1Z3",
    "gstin": "19AAHCC4947L1Z3",
    "cin": "U25208WB2018PTC225425",
    "phone": "9339505470",
}

NO_DIM_TYPES = ["ink", "inks", "solvent", "solvents", "adhesive", "adhesives",
                "extrusion ink", "lamination ink"]


def _get_po(po_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT po_id, supplier_name, supplier_contact, supplier_gst,
               supplier_email, billing_address, shipping_address,
               tracking_id, order_date, status, notes
        FROM purchase_orders WHERE po_id = :1
    """, [po_id])
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        return None
    keys = ["po_id", "supplier_name", "supplier_contact", "supplier_gst",
            "supplier_email", "billing_address", "shipping_address",
            "tracking_id", "order_date", "status", "notes"]
    d = dict(zip(keys, row))
    if d["po_id"] is not None:
        d["po_id"] = int(d["po_id"])
    return d


def _dim_display(sku_type, sku_dim):
    """Return '-' for categories without dimensions."""
    for t in NO_DIM_TYPES:
        if t in (sku_type or "").lower():
            return "-"
    return sku_dim or "-"


def _fmt_date(d):
    if not d:
        return ""
    if isinstance(d, datetime):
        return d.strftime("%d.%m.%y")
    try:
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return dt.strftime("%d.%m.%y")
    except Exception:
        return str(d)[:10]


def _get_product_codes():
    """Load product codes from PRODUCT_MASTER keyed by (type, subtype)."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT PRODUCT_TYPE, PRODUCT_SUBTYPE, PRODUCT_CODE FROM PRODUCT_MASTER WHERE PRODUCT_CODE IS NOT NULL")
        codes = {}
        for ptype, psub, code in cursor.fetchall():
            if ptype and psub and code:
                codes[(str(ptype).strip().upper(), str(psub).strip().upper())] = str(code).strip()
        cursor.close()
        conn.close()
        return codes
    except Exception:
        return {}


def generate_po_pdf(po_id, delivery_date="AS MENTIONED",
                    freight="", payment_terms="As usual") -> bytes:
    po = _get_po(po_id)
    if not po:
        return None
    items = get_purchase_order_items(po_id)

    fname = (po["supplier_name"] or "").split(" ")[0].upper()
    po_number = f"CPPL-{fname}/PO/{str(po['po_id']).zfill(4)}"

    pdf = FPDF("P", "pt", "A4")
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()

    # ── Outer border ──
    pdf.rect(25, 15, 545, 810)

    # ── HEADER: Company Info (top-left) ──
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_xy(30, 20)
    pdf.cell(300, 14, COMPANY_INFO["name"])

    pdf.set_font("Helvetica", "", 8)
    y = 34
    for label, val in [
        ("Address:", COMPANY_INFO["address"]),
        ("PAN ::", COMPANY_INFO["pan"]),
        ("GSTIN ::", COMPANY_INFO["gstin"]),
        ("CIN ::", COMPANY_INFO["cin"]),
        ("Phone No.", COMPANY_INFO["phone"]),
    ]:
        pdf.set_xy(30, y)
        pdf.set_font("Helvetica", "I", 7.5)
        pdf.cell(45, 11, label)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(250, 11, val)
        y += 11

    # ── HEADER: Purchase Order title (top-right) ──
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_xy(380, 20)
    pdf.cell(185, 16, "Purchase Order", align="R")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(380, 36)
    pdf.cell(185, 12, f"PO No. {po_number}", align="R")

    # ── Horizontal line after header (blue like original) ──
    pdf.set_draw_color(22, 53, 92)
    pdf.set_line_width(5)
    pdf.line(34, 92, 560, 92)
    pdf.set_line_width(0.2)
    pdf.set_draw_color(0, 0, 0)

    # ── Supplier Info (left) + Order details (right) ──
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_xy(30, 96)
    pdf.cell(60, 11, "Supplier Name ::")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(105, 96)
    pdf.cell(200, 11, po["supplier_name"] or "")

    # Supplier billing address below
    if po.get("billing_address"):
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_xy(30, 108)
        pdf.multi_cell(280, 10, po["billing_address"])

    # Right side: dates
    right_x = 380
    pdf.set_font("Helvetica", "B", 8)
    details = [
        ("Order Date:", _fmt_date(po["order_date"])),
        ("Delivery Date:", delivery_date),
        ("Freight & Insurance:", freight or "-"),
        ("Payment Terms:", payment_terms),
    ]
    dy = 96
    for label, val in details:
        pdf.set_xy(right_x, dy)
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.cell(80, 11, label)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_xy(right_x + 85, dy)
        pdf.cell(100, 11, val, align="R")
        dy += 12

    # ── Horizontal line ──
    pdf.set_draw_color(22, 53, 92)
    pdf.set_line_width(5)
    pdf.line(34, 148, 560, 148)
    pdf.set_line_width(0.2)
    pdf.set_draw_color(0, 0, 0)

    # ── Ship To / Invoice To ──
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(30, 152)
    pdf.cell(100, 11, "Ship To:")
    pdf.set_xy(310, 152)
    pdf.cell(100, 11, "Invoice To:")

    pdf.set_font("Helvetica", "", 7.5)
    # Ship To
    pdf.set_xy(30, 163)
    pdf.cell(270, 10, COMPANY_INFO["name"])
    ship_addr = po.get("shipping_address") or ""
    if ship_addr:
        pdf.set_xy(30, 173)
        pdf.multi_cell(180, 9, ship_addr)
    ship_y = pdf.get_y()
    pdf.set_xy(30, ship_y)
    pdf.cell(270, 10, f"GSTIN : {COMPANY_INFO['gstin']}")

    # Invoice To
    pdf.set_xy(310, 163)
    pdf.cell(255, 10, COMPANY_INFO["name"])
    inv_addr = po.get("billing_address") or COMPANY_INFO["address"]
    pdf.set_xy(310, 173)
    pdf.multi_cell(155, 9, inv_addr)
    inv_y = pdf.get_y()
    pdf.set_xy(310, inv_y)
    pdf.cell(255, 10, f"GSTIN : {COMPANY_INFO['gstin']}")

    table_start_y = max(ship_y, inv_y) + 16

    # ── Item Table Header ──
    col_x = [30, 55, 220, 330, 380, 460, 565]
    col_w = [25, 165, 110, 50, 80, 105]
    headers = ["Sl. No.", "Particulars", "Code", "Dim", "Quantity (Kg)", "Price"]

    # Blue header background like the original PO format
    pdf.set_fill_color(22, 53, 92)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(col_x[0], table_start_y)
    pdf.set_text_color(255,255,255)
    for i, h in enumerate(headers):
        pdf.set_xy(col_x[i], table_start_y)
        pdf.cell(col_w[i], 14, h, border=1, align="C", fill=True)
    pdf.set_text_color(0,0,0)

    # ── Item Rows ──
    row_y = table_start_y + 14
    total_qty = 0.0
    product_codes = _get_product_codes()

    for idx, item in enumerate(items):
        sku_type = item.get("sku_type") or ""
        sku_subtype = item.get("sku_subtype") or ""
        sku_dim = _dim_display(sku_type, item.get("sku_dim"))
        qty = float(item.get("sku_quantity") or 0)
        cost = item.get("sku_cost_price")
        # Look up product code from master table
        code = product_codes.get((sku_type.strip().upper(), sku_subtype.strip().upper()), "")
        total_qty += qty

        pdf.set_font("Helvetica", "", 8)
        pdf.set_xy(col_x[0], row_y)
        pdf.cell(col_w[0], 13, str(idx + 1), border=1, align="C")
        pdf.set_xy(col_x[1], row_y)
        pdf.cell(col_w[1], 13, sku_subtype or sku_type, border=1)
        pdf.set_xy(col_x[2], row_y)
        pdf.cell(col_w[2], 13, code, border=1, align="C")
        pdf.set_xy(col_x[3], row_y)
        pdf.cell(col_w[3], 13, sku_dim, border=1, align="C")
        pdf.set_xy(col_x[4], row_y)
        pdf.cell(col_w[4], 13, f"{qty:.3f}", border=1, align="C")
        pdf.set_xy(col_x[5], row_y)
        price_str = f"Rs. {float(cost):.2f}" if cost else "-"
        pdf.cell(col_w[5], 13, price_str, border=1, align="R")
        row_y += 13

    # ── Total Row ──
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(col_x[0], row_y)
    pdf.cell(col_w[0] + col_w[1] + col_w[2] + col_w[3], 14,
             "Total (In Kgs) -", border=1, align="R")
    pdf.set_xy(col_x[4], row_y)
    pdf.cell(col_w[4], 14, f"{total_qty:.3f}", border=1, align="C")
    pdf.set_xy(col_x[5], row_y)
    pdf.cell(col_w[5], 14, "", border=1)
    row_y += 14

    # ── Note ──
    row_y += 10
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_xy(30, row_y)
    pdf.cell(200, 12, f"Note :: {po.get('notes') or 'PL.'}")

    # ── Signature ──
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(350, row_y)
    pdf.cell(215, 12, f"For {COMPANY_INFO['name']}", align="R")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_xy(350, row_y + 30)
    pdf.cell(215, 12, "Authorized Signatory", align="R")

    return pdf.output()
