"""Generates a customer ledger PDF."""
from fpdf import FPDF
from datetime import datetime, date, timedelta
from backend.database.db import get_db
from fastapi import FastAPI, Response

app = FastAPI()


def _format_amount(v):
    """Format as Indian number: 1,23,456.00"""
    if v is None:
        return ""
    s = f"{abs(v):,.2f}"
    # Convert to Indian grouping: last 3, then groups of 2
    parts = s.split(".")
    num = parts[0].replace(",", "")
    dec = parts[1]
    if len(num) > 3:
        last3 = num[-3:]
        rest = num[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        return ",".join(groups) + "," + last3 + "." + dec
    return num + "." + dec


def _fmt_date(d):
    if not d:
        return ""
    if isinstance(d, (datetime, date)):
        dt = d
    else:
        try:
            dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        except:
            return str(d)[:10]
    # Windows-safe: remove leading zero manually
    day = str(dt.day)
    mon = dt.strftime("%b")
    yr  = dt.strftime("%y")
    return f"{day}-{mon}-{yr}"


def _fy_label(order_id):
    now = datetime.now()
    month = now.month
    year = now.year % 100
    fy_start = year if month >= 4 else year - 1
    fy_end = fy_start + 1
    return f"CP/{str(order_id).zfill(4)}/{fy_start}-{str(fy_end).zfill(2)}"


def get_ledger_data(customer_id, date_from, date_to):
    """
    Returns entries for a customer ledger in the period date_from..date_to.
    date_from, date_to can be strings 'YYYY-MM-DD' or date/datetime objects.
    """
    from datetime import date as date_type, datetime as datetime_type
    # Normalize to date objects for Oracle binding
    if isinstance(date_from, str):
        date_from = datetime.strptime(date_from[:10], "%Y-%m-%d").date()
    if isinstance(date_to, str):
        date_to = datetime.strptime(date_to[:10], "%Y-%m-%d").date()

    conn = get_db()
    cursor = conn.cursor()

    # Customer info
    cursor.execute("""
        SELECT fname, mname, lname, contact, address, city, state, pincode, gst
        FROM customers WHERE customer_id = :1
    """, [customer_id])
    row = cursor.fetchone()
    if not row:
        cursor.close(); conn.close()
        return None
    customer = {
        "name": " ".join(filter(None, [row[0], row[1], row[2]])),
        "contact": row[3] or "",
        "address": row[4] or "",
        "city": row[5] or "",
        "state": row[6] or "",
        "pincode": str(row[7] or ""),
        "gst": row[8] or ""
    }

    # Opening balance: sum of all debits (orders with GST) minus all credits (payments) BEFORE date_from
    cursor.execute("""
        SELECT NVL(SUM((o.total_amount + NVL(o.delivery_charge,0)) * 1.18), 0)
        FROM orders o
        WHERE o.customer_id = :1 AND TRUNC(o.order_date) < :2
    """, [customer_id, date_from])
    pre_debit = float(cursor.fetchone()[0] or 0)

    cursor.execute("""
        SELECT NVL(SUM(p.amt_paid), 0)
        FROM payments p
        WHERE p.customer_id = :1 AND p.payment_date < :2
    """, [customer_id, date_from])
    pre_credit = float(cursor.fetchone()[0] or 0)
    opening_balance = pre_debit - pre_credit

    # Orders in period (debit entries)
    cursor.execute("""
        SELECT o.order_id, o.order_date,
               (o.total_amount + NVL(o.delivery_charge, 0)) * 1.18 AS amount
        FROM orders o
        WHERE o.customer_id = :1
          AND TRUNC(o.order_date) >= :2
          AND TRUNC(o.order_date) <= :3
        ORDER BY o.order_date, o.order_id
    """, [customer_id, date_from, date_to])
    orders = cursor.fetchall()

    # Payments in period (credit entries)
    cursor.execute("""
        SELECT p.payment_id, p.payment_date, p.amt_paid, p.notes
        FROM payments p
        WHERE p.customer_id = :1
          AND p.payment_date >= :2
          AND p.payment_date <= :3
        ORDER BY p.payment_date, p.payment_id
    """, [customer_id, date_from, date_to])
    payments = cursor.fetchall()
    cursor.close()
    conn.close()

    # Merge and sort entries
    entries = []
    for order_id, order_date, amount in orders:
        entries.append({
            "date": order_date,
            "to_by": "To",
            "particulars": "GST SALES",
            "vch_type": "",
            "vch_no": _fy_label(order_id),
            "debit": round(float(amount), 2),
            "credit": None
        })
    for pay_id, pay_date, amt_paid, notes in payments:
        entries.append({
            "date": pay_date,
            "to_by": "By",
            "particulars": "HDFC 50200032666990",
            "vch_type": "Receipt",
            "vch_no": "",
            "debit": None,
            "credit": round(float(amt_paid), 2)
        })
    entries.sort(key=lambda e: (e["date"], 0 if e["to_by"] == "To" else 1))

    return {
        "customer": customer,
        "date_from": date_from,
        "date_to": date_to,
        "opening_balance": opening_balance,
        "entries": entries
    }


def generate_ledger_pdf(customer_id, date_from, date_to) -> bytes:
    data = get_ledger_data(customer_id, date_from, date_to)
    if not data:
        return None

    cust = data["customer"]
    entries = data["entries"]
    opening = data["opening_balance"]

    pdf = FPDF("P", "pt", "A4")
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()

    # ── Company Header ──────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_xy(30, 20)
    pdf.cell(532, 14, "CHAMPA POLYPLAST PRIVATE LIMITED", align="C")
    pdf.set_font("Helvetica", "", 8)
    for line in [
        "3/B, PORTUGUESE CHURCH STREET",
        "2ND FLOOR, KOLKATA 700001",
        "MOB : 9804279313/ 9830130155",
        "MSME REG : UDYAM-WB-10-0017062",
        "CIN: U25208WB2018PTC225425",
        "E-Mail : bkpolythenes@yahoo.co.in",
    ]:
        pdf.set_xy(30, pdf.get_y() + 10)
        pdf.cell(532, 15, line, align="C")

    # Customer name + Ledger Account
    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_xy(30, pdf.get_y() + 6)
    pdf.cell(532, 14, cust["name"].upper(), align="C")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_xy(30, pdf.get_y() + 14)
    pdf.cell(532, 11, "Ledger Account", align="C")
    for addr_line in [cust["address"], cust["city"], f"PIN {cust['pincode']}", cust["state"]]:
        if addr_line and addr_line.strip():
            pdf.set_xy(30, pdf.get_y() + 11)
            pdf.cell(532, 11, addr_line.upper(), align="C")

    # Date range
    df_str = _fmt_date(date_from)
    dt_str = _fmt_date(date_to)
    pdf.ln(4)
    pdf.set_xy(30, pdf.get_y() + 6)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(532, 11, f"{df_str} to {dt_str}", align="C")

    # Page number
    pdf.set_font("Helvetica", "", 7)
    pdf.set_xy(490, 20)
    pdf.cell(72, 10, "Page 1", align="R")

    # ── Table header ────────────────────────────────────────────
    table_y = pdf.get_y() + 160
    pdf.line(30, table_y, 562, table_y)
    pdf.set_font("Helvetica", "B", 8)
    col_x = [30, 75, 230, 350, 415, 487, 562]
    headers = ["Date", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit"]
    widths  = [45, 155, 120, 65, 72, 75]
    aligns  = ["L", "L", "L", "L", "R", "R"]
    pdf.set_xy(col_x[0], table_y + 3)
    for i, h in enumerate(headers):
        pdf.set_xy(col_x[i], table_y + 3)
        pdf.cell(widths[i], 14, h, align=aligns[i])
    pdf.line(30, table_y + 18, 562, table_y + 18)

    row_y = table_y + 20
    ROW_H = 13
    PAGE_H = 780

    def _new_page():
        nonlocal row_y
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 8)
        pdf.line(30, 30, 562, 30)
        for i, h in enumerate(headers):
            pdf.set_xy(col_x[i], 33)
            pdf.cell(widths[i], 14, h, align=aligns[i])
        pdf.line(30, 48, 562, 48)
        row_y = 50

    def _row(dt_str, to_by, particulars_main, particulars_sub, vch_type, vch_no, debit, credit, bold_part=False):
        nonlocal row_y
        if row_y + ROW_H > PAGE_H:
            _new_page()
        pdf.set_font("Helvetica", "", 7.5)
        # Date
        pdf.set_xy(col_x[0], row_y)
        pdf.cell(widths[0], ROW_H, dt_str)
        # Particulars: "To/By  MAIN"
        pdf.set_xy(col_x[1], row_y)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(14, ROW_H, to_by)
        pdf.set_font("Helvetica", "B" if bold_part else "", 7.5)
        pdf.set_xy(col_x[1] + 16, row_y)
        pdf.cell(widths[1] - 16, ROW_H, particulars_main)
        if particulars_sub:
            pdf.set_xy(col_x[1] + 16, row_y)
            # Sub-particulars on same line after main (smaller)
            pdf.set_font("Helvetica", "", 6.5)
            pdf.set_xy(col_x[1] + 70, row_y)
            pdf.cell(85, ROW_H, particulars_sub, align="L")
        # Vch Type
        pdf.set_font("Helvetica", "", 6.5)
        pdf.set_xy(col_x[2], row_y)
        pdf.cell(widths[2], ROW_H, vch_type, align="L")
        # Vch No.
        pdf.set_xy(col_x[3], row_y)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.cell(widths[3], ROW_H, vch_no)
        # Debit
        pdf.set_xy(col_x[4], row_y)
        pdf.cell(widths[4], ROW_H, _format_amount(debit) if debit else "", align="R")
        # Credit
        pdf.set_xy(col_x[5], row_y)
        pdf.cell(widths[5], ROW_H, _format_amount(credit) if credit else "", align="R")
        row_y += ROW_H

    # Opening balance row
    if opening != 0:
        df_str_fmt = _fmt_date(date_from)
        _row(df_str_fmt, "To", "Opening Balance", "", "", "",
             round(opening, 2) if opening > 0 else None,
             round(-opening, 2) if opening < 0 else None, bold_part=True)

    # All entries
    total_debit = round(opening, 2) if opening > 0 else 0
    total_credit = round(-opening, 2) if opening < 0 else 0

    prev_date = None
    for e in entries:
        date_label = _fmt_date(e["date"]) if e["date"] != prev_date else ""
        prev_date = e["date"]
        _row(date_label, e["to_by"], e["particulars"], "", e["vch_type"], e["vch_no"],
             e["debit"], e["credit"])
        if e["debit"]:
            total_debit += e["debit"]
        if e["credit"]:
            total_credit += e["credit"]

    # ── Subtotals ──────────────────────────────────────────────
    pdf.line(30, row_y, 562, row_y)
    row_y += 2
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(col_x[4], row_y)
    pdf.cell(widths[4], ROW_H, _format_amount(total_debit), align="R")
    pdf.set_xy(col_x[5], row_y)
    pdf.cell(widths[5], ROW_H, _format_amount(total_credit), align="R")
    row_y += ROW_H

    # Closing balance
    closing = total_debit - total_credit
    _row("", "By", "Closing Balance", "", "", "", None, round(abs(closing), 2), bold_part=True)
    grand = max(total_debit, total_credit + abs(closing))

    # Grand total line
    pdf.line(30, row_y, 562, row_y)
    row_y += 2
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(col_x[4], row_y)
    pdf.cell(widths[4], ROW_H, _format_amount(grand), align="R")
    pdf.set_xy(col_x[5], row_y)
    pdf.cell(widths[5], ROW_H, _format_amount(grand), align="R")
    row_y += ROW_H
    pdf.line(30, row_y, 562, row_y)
    pdf.line(30, row_y + 2, 562, row_y + 2)

    return pdf.output()

@app.get("/test-ledger/{customer_id}")
def test_ledger(customer_id: int):
    pdf = generate_ledger_pdf(customer_id,"2026-04-01","2027-03-31")
    return Response(content=bytes(pdf), media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=Ledger_{customer_id}.pdf"})