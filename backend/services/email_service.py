"""Email service for sending verification codes via Gmail SMTP."""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from pathlib import Path

# Load .env from backend directory
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# ── SMTP Configuration (from .env) ───────────────────────────
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD")


def send_reset_code(recipients: list[str], code: str, user_name: str):
    """
    Send password reset verification code to the given recipient emails.

    Args:
        recipients: List of email addresses to send the code to.
        code: The 6-digit verification code.
        user_name: Name of the user requesting the reset (for context).
    """
    subject = "Password Reset Verification Code"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">Password Reset Request</h2>
        <p style="color: #555; font-size: 14px;">
            A password reset was requested for the account of <strong>{user_name}</strong>.
        </p>
        <div style="background: #f4f6ff; border: 2px solid #1a1a2e; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Your verification code:</p>
            <h1 style="margin: 0; font-size: 36px; letter-spacing: 6px; color: #1a1a2e;">{code}</h1>
        </div>
        <p style="color: #888; font-size: 12px;">
            This code expires in <strong>10 minutes</strong>. If you did not request this, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #aaa; font-size: 11px;">Inventory Management System</p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Inventory System <{SMTP_EMAIL}>"
    msg["To"] = ", ".join(recipients)

    # Plain text fallback
    plain_body = f"Password reset requested for {user_name}.\n\nVerification code: {code}\n\nThis code expires in 10 minutes."
    msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            server.sendmail(SMTP_EMAIL, recipients, msg.as_string())
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send reset code: {e}")
        return False
