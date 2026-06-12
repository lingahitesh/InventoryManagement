"""Generates a PDF invoice (Pro forma Invoice) for a given order."""
from functools import lru_cache
from fpdf import FPDF
from fastapi import FastAPI, Response
from datetime import datetime
from backend.services.order_service import get_order_full, get_order_items
from backend.database.db import get_db

app = FastAPI()

@lru_cache(maxsize=1)
def _load_hsn_map():
    """Load HSN codes from PRODUCT_MASTER table keyed by (type, subtype)."""
    hsn_map = {}
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT PRODUCT_TYPE, PRODUCT_SUBTYPE, HSN_CODE FROM PRODUCT_MASTER WHERE HSN_CODE IS NOT NULL")
        for ptype, psub, hsn in cursor.fetchall():
            if ptype and psub and hsn:
                hsn_map[(str(ptype).strip().upper(), str(psub).strip().upper())] = str(hsn).strip()
        cursor.close()
        conn.close()
    except Exception:
        pass
    return hsn_map


def _get_hsn(sku_type, sku_subtype):
    m = _load_hsn_map()
    return m.get((str(sku_type).upper(), str(sku_subtype).upper()), "39206220")


def _num_to_words(n):
    ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
            "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
            "Seventeen","Eighteen","Nineteen"]
    tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"]
    n = int(n)
    if n == 0: return "Zero"
    result = ""
    if n >= 10000000:
        result += ones[n // 10000000] + " Crore "; n %= 10000000
    if n >= 100000:
        result += _two_digits(n // 100000) + " Lakh "; n %= 100000
    if n >= 1000:
        result += _two_digits(n // 1000) + " Thousand "; n %= 1000
    if n >= 100:
        result += ones[n // 100] + " Hundred "; n %= 100
    if n > 0:
        result += _two_digits(n)
    return result.strip()


def _two_digits(n):
    ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
            "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
            "Seventeen","Eighteen","Nineteen"]
    tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"]
    if n < 20: return ones[n]
    return tens[n // 10] + (" " + ones[n % 10] if n % 10 else "")


def get_customer_details(customer_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT fname, mname, lname, contact, email, address, pincode, city, state, gst FROM customers WHERE customer_id=:1", [customer_id])
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row: return None
    keys = ["fname","mname","lname","contact","email","address","pincode","city","state","gst"]
    return dict(zip(keys, row))


def _draw_header(pdf, order, customer, date_str):
    """Draw the full header section (company info, customer, right panel) on current page."""
    pdf.set_xy(30, 13)
    pdf.set_font("Helvetica", "B", 10.4)
    pdf.cell(532, 12, "PROFORMA INVOICE", align="C")
    pdf.set_xy(460, 13)
    pdf.set_font("Helvetica", "I", 8.1)
    pdf.cell(100, 12, "(ORIGINAL FOR RECIPIENT)", align="R")
    pdf.rect(30, 25, 532, 223)
    pdf.line(333, 25, 333, 248)
    pdf.line(30, 130, 333, 130)
    pdf.line(30, 185, 333, 185)

    # Company info
    pdf.set_xy(32, 30)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 10, "CHAMPA POLYPLAST PRIVATE LIMITED")
    pdf.set_xy(32, 40)
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(200, 11, "3/B, PORTUGUESE CHURCH STREET\n2ND FLOOR, KOLKATA 700001\nMOB : 9804279313/ 9830130155\nMSME REG : UDYAM-WB-10-0017062\nGSTIN/UIN: 19AAHCC4947L1Z3\nState Name :  West Bengal, Code : 19\nCIN: U25208WB2018PTC225425\nE-Mail : bkpolythenes@yahoo.co.in")

    # Consignee (Ship To) — fix #4: use smaller font if text is long
    name = " ".join(filter(None, [customer["fname"], customer["mname"], customer["lname"]]))
    consignee_text = f"Consignee (Ship To)\n{name}\n{customer['address']}, {customer['city']}\nGSTIN/UIN      : {customer['gst']}\nState Name     : {customer['state']}, Code : {customer['pincode']}"
    pdf.set_xy(32, 132)
    pdf.set_font("Helvetica", "", 7.5 if len(consignee_text) > 150 else 8)
    pdf.multi_cell(298, 9 if len(consignee_text) > 150 else 10, consignee_text)

    # Buyer (Bill To) — fix #4: dynamic sizing
    pdf.set_xy(32, 190)
    ship_parts = order["shipping_address"].split(",") if order.get("shipping_address") else []
    addr_line = ", ".join(p.strip() for p in ship_parts[:-2]) if len(ship_parts) > 2 else order.get("shipping_address", "")
    state_line = ", ".join(p.strip() for p in ship_parts[-2:]) if len(ship_parts) > 2 else ""
    buyer_text = f"Buyer (Bill To)\n{name}\n{addr_line}\nGSTIN/UIN      : {customer['gst']}\nState Name     : {state_line}"
    pdf.set_font("Helvetica", "", 7.5 if len(buyer_text) > 150 else 8)
    pdf.multi_cell(298, 9 if len(buyer_text) > 150 else 10, buyer_text)

    # Right panel
    pdf.line(445, 25, 445, 153)
    for y in [45, 65, 87, 110, 132, 153]:
        pdf.line(333, y, 562, y)

    # noinspection PyShadowingNames
    def _right_field(label, value, x, y, bold=True):
        pdf.set_xy(x, y)
        pdf.set_font("Helvetica", "", 7.2)
        pdf.cell(108, 10, label)
        pdf.set_xy(x, y + 10)
        pdf.set_font("Helvetica", "B" if bold else "", 8)
        pdf.cell(108, 10, value)

    _right_field("Invoice No.", "PROFORMA INVOICE", 336, 25)
    _right_field("Dated", date_str, 448, 25)
    _right_field("Delivery Note", "", 336, 46)
    _right_field("Mode/Terms of Payment", "", 448, 46)
    # Reference No. & Date — fix #3: reduced char spacing to fit
    pdf.set_xy(336, 68); pdf.set_font("Helvetica", "", 7.2); pdf.cell(108, 10, "Reference No. & Date.")
    pdf.set_xy(336, 78); pdf.set_char_spacing(-0.6); pdf.set_font("Helvetica", "B", 7.2); pdf.cell(108, 10, f"PROFORMA INVOICE dt. {date_str}"); pdf.set_char_spacing(0)
    _right_field("Other References", "", 448, 68)
    _right_field("Buyer's Order No.", "", 336, 89)
    _right_field("Dated", "", 448, 89)
    _right_field("Dispatch Doc No.", "", 336, 112)
    _right_field("Delivery Note Date", "", 448, 112)
    _right_field("Dispatched through", "SELF - PICK UP", 336, 134)
    city = ship_parts[-3].strip().upper() if len(ship_parts) >= 3 else "KOLKATA"
    _right_field("Destination", city, 448, 134)
    pdf.set_xy(336, 155); pdf.set_font("Helvetica", "", 7.2); pdf.cell(226, 10, "Terms of Delivery")


def _draw_table_header(pdf, y_start):
    """Draw the item table header row."""
    pdf.line(30, y_start + 24, 562, y_start + 24)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_xy(29, y_start + 4); pdf.multi_cell(20, 10, "Sl\nNo.")
    pdf.set_xy(45, y_start + 4); pdf.multi_cell(50, 10, "No. & Kind\n  of Pkgs.")
    pdf.set_xy(158, y_start + 4); pdf.cell(200, 18, "Description of Goods")
    pdf.set_xy(308, y_start + 4); pdf.cell(50, 18, "HSN/SAC")
    pdf.set_xy(362, y_start + 4); pdf.cell(48, 18, "Quantity")
    pdf.set_xy(420, y_start + 4); pdf.cell(50, 18, "Rate")
    pdf.set_xy(462, y_start + 4); pdf.cell(20, 18, "per")
    pdf.set_xy(503, y_start + 4); pdf.cell(95, 18, "Amount")


def generate_invoice_pdf(order_id) -> bytes:
    order = get_order_full(order_id)
    if not order: return None
    items = get_order_items(order_id)
    customer = get_customer_details(order["customer_id"])
    if not customer: return None

    try:
        date_str = datetime.strptime(order["order_date"], "%Y-%m-%dT%H:%M:%S").strftime("%d-%b-%y")
    except:
        date_str = str(order.get("order_date", ""))[:10]

    pdf = FPDF("P", "pt", "A4")
    pdf.set_auto_page_break(auto=False)

    # Pre-compute item data
    item_data = []
    grand_total_qty = 0
    grand_total_amt = 0
    hsn_groups = {}

    for item in items:
        units = int(item.get("units_ordered") or 0)
        batch_kg = float(item.get("batch_qty_kg") or 0)
        price = float(item.get("selling_price") or 0)
        qty_kgs = units * batch_kg
        amount = qty_kgs * price
        grand_total_qty += qty_kgs
        grand_total_amt += amount

        sku_type = item.get("sku_type") or ""
        sku_subtype = item.get("sku_subtype") or ""
        sku_dim = item.get("sku_dim") or ""
        hsn = _get_hsn(sku_type, sku_subtype)
        hsn_groups[hsn] = hsn_groups.get(hsn, 0) + amount

        desc = f"{sku_type} FILM {'METALIZED' if 'MET' in sku_type.upper() else 'PLAIN'}"
        item_data.append({
            "units": units, "desc": desc, "hsn": hsn,
            "qty_kgs": qty_kgs, "price": price, "amount": amount,
            "sku_type": sku_type, "sku_dim": sku_dim, "batch_kg": batch_kg
        })

    sgst = round(grand_total_amt * 0.09, 2)
    cgst = round(grand_total_amt * 0.09, 2)
    total_with_tax = grand_total_amt + sgst + cgst
    round_off = round(total_with_tax) - total_with_tax
    final_total = round(total_with_tax)

    # Determine pagination: ~8 items per page (each item ~30pt tall)
    ITEMS_PER_FIRST_PAGE = 7
    ITEMS_PER_CONT_PAGE = 14
    total_items = len(item_data)
    needs_multi = total_items > ITEMS_PER_FIRST_PAGE

    if needs_multi:
        # Page 1: first ITEMS_PER_FIRST_PAGE items (continuation page)
        # Remaining items go on the last page (with totals)
        idx = 0
        page_num = 1

        # First page(s): fill with ITEMS_PER_CONT_PAGE (or ITEMS_PER_FIRST_PAGE for page 1)
        # Page 1 gets first batch
        first_batch = ITEMS_PER_FIRST_PAGE
        pdf.add_page()
        _draw_header(pdf, order, customer, date_str)
        table_y = 248
        pdf.rect(30, table_y, 532, 502)
        _draw_table_header(pdf, table_y)
        for x in [42, 95, 300, 353, 405, 459, 482]:
            pdf.line(x, table_y, x, 750)
        y = table_y + 27
        for i in range(first_batch):
            _draw_item_row(pdf, y, idx + 1, item_data[idx])
            y += 30
            idx += 1
        pdf.line(30, 735, 562, 735)
        pdf.set_xy(250, 752); pdf.set_font("Helvetica", "", 7)
        pdf.cell(250, 10, f"(Continued to page {page_num + 1})")
        page_num += 1

        # Middle continuation pages if needed
        while (total_items - idx) > ITEMS_PER_CONT_PAGE:
            pdf.add_page()
            _draw_header(pdf, order, customer, date_str)
            pdf.rect(30, 248, 532, 502)
            _draw_table_header(pdf, 248)
            for x in [42, 95, 300, 353, 405, 459, 482]:
                pdf.line(x, 248, x, 750)
            y = 275
            for i in range(ITEMS_PER_CONT_PAGE):
                _draw_item_row(pdf, y, idx + 1, item_data[idx])
                y += 30
                idx += 1
            pdf.line(30, 735, 562, 735)
            pdf.set_xy(250, 752); pdf.set_font("Helvetica", "", 7)
            pdf.cell(250, 10, f"(Continued to page {page_num + 1})")
            page_num += 1

        # Final page with remaining items + totals
        pdf.add_page()
        _draw_header(pdf, order, customer, date_str)
        table_y = 248
        remaining_items = total_items - idx
        table_bottom = table_y + 24 + remaining_items * 30 + 80
        if table_bottom < 480: table_bottom = 480
        pdf.rect(30, table_y, 532, table_bottom - table_y)
        _draw_table_header(pdf, table_y)
        for x in [42, 95, 300, 353, 405, 459, 482]:
            pdf.line(x, table_y, x, table_bottom)

        y = table_y + 27
        while idx < total_items:
            _draw_item_row(pdf, y, idx + 1, item_data[idx])
            y += 30
            idx += 1

        _draw_totals_and_footer(pdf, grand_total_qty, grand_total_amt, sgst, cgst, round_off, final_total, hsn_groups, table_bottom)

    else:
        # Single page
        pdf.add_page()
        _draw_header(pdf, order, customer, date_str)
        table_y = 248
        table_bottom = 550
        pdf.rect(30, table_y, 532, table_bottom - table_y)
        _draw_table_header(pdf, table_y)
        for x in [42, 95, 300, 353, 405, 459, 482]:
            pdf.line(x, table_y, x, table_bottom)

        y = table_y + 27
        for idx, d in enumerate(item_data):
            _draw_item_row(pdf, y, idx + 1, d)
            y += 30

        _draw_totals_and_footer(pdf, grand_total_qty, grand_total_amt, sgst, cgst, round_off, final_total, hsn_groups, table_bottom)

    return pdf.output()


def _draw_item_row(pdf, y, sl, d):
    pdf.set_font("Helvetica", "", 8)
    pdf.set_xy(30, y); pdf.cell(12, 14, str(sl), align="C")
    pdf.set_xy(44, y); pdf.set_font("Helvetica", "B", 8); pdf.cell(50, 14, f"{d['units']:02d} ROLLS")
    pdf.set_xy(97, y); pdf.cell(200, 14, d["desc"])
    pdf.set_xy(302, y); pdf.set_font("Helvetica", "", 8); pdf.cell(50, 14, d["hsn"], align="C")
    pdf.set_xy(355, y); pdf.set_font("Helvetica", "B", 8); pdf.cell(48, 14, f"{d['qty_kgs']:.3f} KGS", align="C")
    pdf.set_xy(407, y); pdf.set_font("Helvetica", "", 8); pdf.cell(50, 14, f"{d['price']:.2f}", align="C")
    pdf.set_xy(461, y); pdf.cell(20, 14, "KGS", align="C")
    pdf.set_xy(484, y); pdf.set_font("Helvetica", "B", 8); pdf.cell(76, 14, f"{d['amount']:,.2f}", align="R")
    # Sub row
    pdf.set_xy(97, y + 14); pdf.set_font("Helvetica", "", 7)
    pdf.cell(200, 10, f'" {d["sku_type"]} {d["sku_dim"]} = {d["batch_kg"]:.3f}  {d["units"]}R "')


def _draw_totals_and_footer(pdf, grand_total_qty, grand_total_amt, sgst, cgst, round_off, final_total, hsn_groups, table_bottom):
    # Line before subtotal
    y = table_bottom - 80
    pdf.line(482, y, 562, y)

    # Subtotal amount
    pdf.set_xy(484, y + 2); pdf.set_font("Helvetica", "B", 8); pdf.cell(76, 12, f"{grand_total_amt:,.2f}", align="R")
    y += 15
    pdf.set_xy(200, y); pdf.set_font("Helvetica", "B", 8); pdf.cell(100, 12, "SGST")
    pdf.set_xy(484, y); pdf.cell(76, 12, f"{sgst:,.2f}", align="R")
    y += 14
    pdf.set_xy(200, y); pdf.cell(100, 12, "CGST")
    pdf.set_xy(484, y); pdf.cell(76, 12, f"{cgst:,.2f}", align="R")
    y += 14
    pdf.set_xy(130, y); pdf.set_font("Helvetica", "I", 7); pdf.cell(50, 12, "Less :")
    pdf.set_xy(200, y); pdf.set_font("Helvetica", "B", 8); pdf.cell(100, 12, "ROUND OFF")
    ro = f"(-){abs(round_off):.2f}" if round_off < 0 else f"{round_off:.2f}"
    pdf.set_xy(484, y); pdf.cell(76, 12, ro, align="R")

    # Total row
    pdf.line(30, table_bottom - 15, 562, table_bottom - 15)
    pdf.set_xy(275, table_bottom - 15); pdf.set_font("Helvetica", "B", 8); pdf.cell(50, 14, "Total")
    pdf.set_xy(355, table_bottom - 15); pdf.cell(48, 14, f"{grand_total_qty:.3f} KGS", align="C")
    pdf.set_xy(440, table_bottom - 15); pdf.set_font("Helvetica", "B", 9); pdf.cell(120, 14, f"Rs. {final_total:,.2f}", align="R")

    # Amount in words
    pdf.rect(30, table_bottom, 532, 25)
    pdf.set_xy(30, table_bottom - 2); pdf.set_font("Helvetica", "", 7); pdf.cell(120, 16, "Amount Chargeable (in words)")
    pdf.set_xy(30, table_bottom + 9); pdf.set_font("Helvetica", "B", 8)
    pdf.cell(400, 12, f"Indian Rupees {_num_to_words(final_total)} Only")
    pdf.set_xy(500, table_bottom + 3); pdf.set_font("Helvetica", "I", 7); pdf.cell(60, 12, "E. & O.E", align="R")

    # ── Tax table — fix #5: DYNAMIC height based on HSN count ──
    hsn_count = len(hsn_groups)
    tax_header_h = 24
    tax_row_h = 12
    tax_total_row_h = 14
    tax_h = tax_header_h + (hsn_count * tax_row_h) + tax_total_row_h

    tax_y = table_bottom + 25
    pdf.rect(30, tax_y, 532, tax_h)
    pdf.line(30, tax_y + tax_header_h, 562, tax_y + tax_header_h)
    pdf.line(30, tax_y + tax_h - tax_total_row_h, 562, tax_y + tax_h - tax_total_row_h)
    pdf.line(250, tax_y, 250, tax_y + tax_h)
    pdf.line(308, tax_y, 308, tax_y + tax_h)
    pdf.line(345, tax_y + 12, 345, tax_y + tax_h)
    pdf.line(403, tax_y, 403, tax_y + tax_h)
    pdf.line(439, tax_y + 12, 439, tax_y + tax_h)
    pdf.line(498, tax_y, 498, tax_y + tax_h)
    pdf.line(308, tax_y + 12, 498, tax_y + 12)

    pdf.set_xy(122, tax_y + 2); pdf.set_font("Helvetica", "B", 7); pdf.cell(100, 10, "HSN/SAC")
    pdf.set_xy(261, tax_y + 2); pdf.multi_cell(55, 10, "Taxable\n  Value")
    pdf.set_xy(342, tax_y + 2); pdf.cell(60, 10, "CGST")
    pdf.set_xy(426, tax_y + 2); pdf.cell(70, 10, "SGST/UTGST")
    pdf.set_xy(505, tax_y + 2); pdf.multi_cell(55, 10, "      Total\nTax Amount")
    pdf.set_xy(318, tax_y + 14); pdf.set_font("Helvetica", "", 6); pdf.cell(25, 8, "Rate")
    pdf.set_xy(362, tax_y + 14); pdf.cell(40, 8, "Amount")
    pdf.set_xy(412, tax_y + 14); pdf.cell(25, 8, "Rate")
    pdf.set_xy(454, tax_y + 14); pdf.cell(40, 8, "Amount")

    row_y = tax_y + tax_header_h + 1
    pdf.set_font("Helvetica", "", 7)
    for hsn, taxable in hsn_groups.items():
        c = round(taxable * 0.09, 2); s = round(taxable * 0.09, 2)
        pdf.set_xy(122, row_y); pdf.cell(128, 10, hsn)
        pdf.set_xy(252, row_y); pdf.cell(55, 10, f"{taxable:,.2f}", align="R")
        pdf.set_xy(316, row_y); pdf.cell(25, 10, "9%", align="C")
        pdf.set_xy(347, row_y); pdf.cell(55, 10, f"{c:,.2f}", align="R")
        pdf.set_xy(410, row_y); pdf.cell(25, 10, "9%", align="C")
        pdf.set_xy(441, row_y); pdf.cell(55, 10, f"{s:,.2f}", align="R")
        pdf.set_xy(500, row_y); pdf.cell(60, 10, f"{c+s:,.2f}", align="R")
        row_y += tax_row_h

    # Tax totals row
    tot_y = tax_y + tax_h - tax_total_row_h + 2
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_xy(224, tot_y); pdf.cell(25, 10, "Total")
    pdf.set_xy(252, tot_y); pdf.cell(55, 10, f"{grand_total_amt:,.2f}", align="R")
    pdf.set_xy(347, tot_y); pdf.cell(55, 10, f"{cgst:,.2f}", align="R")
    pdf.set_xy(441, tot_y); pdf.cell(55, 10, f"{sgst:,.2f}", align="R")
    pdf.set_xy(500, tot_y); pdf.cell(60, 10, f"{sgst+cgst:,.2f}", align="R")

    # Tax in words
    tiw_y = tax_y + tax_h + 3
    pdf.set_xy(30, tiw_y); pdf.set_font("Helvetica", "", 7); pdf.cell(80, 10, "Tax Amount (in words) :")
    tax_paise = round((sgst + cgst - int(sgst + cgst)) * 100)
    pdf.set_xy(130, tiw_y); pdf.set_font("Helvetica", "B", 8)
    pdf.cell(350, 10, f"Indian Rupees {_num_to_words(int(sgst+cgst))}" + (f" and {_num_to_words(tax_paise)} paise" if tax_paise else "") + " Only")

    # ── Footer — fix #6: OUTER BOX around declaration + bank details ──
    footer_y = tiw_y + 15
    footer_h = 106
    pdf.rect(30, footer_y-18, 532, footer_h)
    #pdf.line(296, footer_y, 296, footer_y + footer_h)  # vertical split

    # Bank details (right side)
    pdf.set_xy(300, footer_y + 3); pdf.set_font("Helvetica", "B", 7); pdf.cell(150, 10, "Company's Bank Details")
    pdf.set_xy(300, footer_y + 13); pdf.set_font("Helvetica", "", 7)
    pdf.multi_cell(240, 9, "A/c Holder's Name : CHAMPA POLYPLAST PRIVATE LIMITED\nBank Name          : HDFC 50200032666990\nA/c No.            : 50200032666990\nBranch & IFS Code  : 19 ARMENIAN STREET & HDFC0001926\nSWIFT Code         :")

    # Company signature (right bottom)
    pdf.rect(300,footer_y + 57.5, 262, 30.5)
    pdf.set_xy(365, footer_y + 58); pdf.set_font("Helvetica", "B", 8)
    pdf.cell(180, 10, "for CHAMPA POLYPLAST PRIVATE LIMITED", align="C")
    pdf.set_xy(439, footer_y + 78); pdf.set_font("Helvetica", "", 7)
    pdf.cell(140, 10, "Authorised Signatory", align="C")

    # PAN + Declaration (left side)
    pdf.set_xy(32, footer_y + 42); pdf.set_font("Helvetica", "B", 7.5)
    pdf.cell(200, 10, "Company's PAN :       AAHCC4947L")
    pdf.set_xy(32, footer_y + 55); pdf.set_font("Helvetica", "B", 7); pdf.cell(100, 10, "Declaration")
    pdf.line(35, footer_y + 63.5, 73, footer_y + 63.5)
    pdf.set_xy(32, footer_y + 65); pdf.set_font("Helvetica", "", 7)
    pdf.multi_cell(240, 10, "We declare that this invoice shows the actual price of the\ngoods described and that all particulars are true and correct.")

    # Computer Generated Invoice
    pdf.set_xy(250, footer_y + footer_h-14); pdf.set_font("Helvetica", "", 7)
    pdf.cell(250, 10, "This is a Computer Generated Invoice")


@app.get("/test-invoice/{order_id}")
def test_invoice(order_id: int):
    pdf = generate_invoice_pdf(order_id)
    return Response(content=bytes(pdf), media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=invoice_{order_id}.pdf"})