"""User authentication and management service."""
import hashlib
import random
import string
from datetime import datetime, timedelta
from backend.database.db import get_db
from backend.services.email_service import send_reset_code
from fastapi import HTTPException


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _generate_code(length=6) -> str:
    return ''.join(random.choices(string.digits, k=length))


def authenticate(email: str, password: str):
    """Authenticate user by email and password. Returns user dict or raises."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, fname, mname, lname, contact, email, role, is_active
        FROM app_users WHERE email = :1 AND password_hash = :2
    """, [email, _hash_password(password)])
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    keys = ["user_id", "fname", "mname", "lname", "contact", "email", "role", "is_active"]
    user = dict(zip(keys, row))
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account is disabled")
    user["user_id"] = int(user["user_id"])
    return user


def get_user(user_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, fname, mname, lname, contact, email, role, is_active, created_by
        FROM app_users WHERE user_id = :1
    """, [user_id])
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        return None
    keys = ["user_id", "fname", "mname", "lname", "contact", "email", "role", "is_active", "created_by"]
    d = dict(zip(keys, row))
    d["user_id"] = int(d["user_id"])
    if d["created_by"]: d["created_by"] = int(d["created_by"])
    return d


def get_all_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, fname, mname, lname, contact, email, role, is_active, created_by
        FROM app_users ORDER BY user_id
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["user_id", "fname", "mname", "lname", "contact", "email", "role", "is_active", "created_by"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        d["user_id"] = int(d["user_id"])
        if d["created_by"]: d["created_by"] = int(d["created_by"])
        result.append(d)
    return result


def create_user(fname, mname, lname, contact, email, password, role, created_by, privileges=None):
    """Create a new user. Root can create admin/normal; admin can create normal only."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check email uniqueness
        cursor.execute("SELECT COUNT(*) FROM app_users WHERE email = :1", [email])
        if int(cursor.fetchone()[0]) > 0:
            raise HTTPException(status_code=400, detail="Email already exists")

        # Role enforcement
        if role == "root":
            raise HTTPException(status_code=400, detail="Cannot create another root user")

        user_id_var = cursor.var(int)
        cursor.execute("""
            INSERT INTO app_users (fname, mname, lname, contact, email, password_hash, role, created_by)
            VALUES (:1, :2, :3, :4, :5, :6, :7, :8)
            RETURNING user_id INTO :9
        """, [fname, mname, lname, contact, email, _hash_password(password), role, created_by, user_id_var])
        new_id = user_id_var.getvalue()[0]

        # Insert privileges for normal users
        if role == "normal" and privileges:
            for module, perms in privileges.items():
                cursor.execute("""
                    INSERT INTO user_privileges (user_id, module, can_view, can_create, can_edit, can_delete, can_generate, can_status)
                    VALUES (:1, :2, :3, :4, :5, :6, :7, :8)
                """, [new_id, module,
                      1 if perms.get("view") else 0,
                      1 if perms.get("create") else 0,
                      1 if perms.get("edit") else 0,
                      1 if perms.get("delete") else 0,
                      1 if perms.get("generate") else 0,
                      1 if perms.get("status") else 0])

        conn.commit()
        return int(new_id)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


def get_user_privileges(user_id: int):
    """Get privileges for a user. Root/admin get all; normal gets specific."""
    user = get_user(user_id)
    if not user:
        return {}
    if user["role"] in ("root", "admin"):
        # Full access
        modules = ["inventory", "customer", "sales_order", "purchase_order", "dispatch", "payment"]
        return {m: {"view": True, "create": True, "edit": True, "delete": True, "generate": True, "status": True} for m in modules}

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT module, can_view, can_create, can_edit, can_delete, can_generate, can_status
        FROM user_privileges WHERE user_id = :1
    """, [user_id])
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    privs = {}
    for row in rows:
        privs[row[0]] = {
            "view": bool(row[1]), "create": bool(row[2]), "edit": bool(row[3]),
            "delete": bool(row[4]), "generate": bool(row[5]), "status": bool(row[6])
        }
    return privs


def update_user_privileges(user_id: int, privileges: dict):
    """Update privileges for a normal user."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM user_privileges WHERE user_id = :1", [user_id])
        for module, perms in privileges.items():
            cursor.execute("""
                INSERT INTO user_privileges (user_id, module, can_view, can_create, can_edit, can_delete, can_generate, can_status)
                VALUES (:1, :2, :3, :4, :5, :6, :7, :8)
            """, [user_id, module,
                  1 if perms.get("view") else 0,
                  1 if perms.get("create") else 0,
                  1 if perms.get("edit") else 0,
                  1 if perms.get("delete") else 0,
                  1 if perms.get("generate") else 0,
                  1 if perms.get("status") else 0])
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


def change_password(user_id: int, old_password: str, new_password: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM app_users WHERE user_id = :1", [user_id])
    row = cursor.fetchone()
    if not row or row[0] != _hash_password(old_password):
        cursor.close(); conn.close()
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    cursor.execute("UPDATE app_users SET password_hash = :1 WHERE user_id = :2",
                   [_hash_password(new_password), user_id])
    conn.commit()
    cursor.close()
    conn.close()


def request_password_reset(email: str):
    """Generate a reset code. For root/admin: code goes to their email.
    For normal users: code goes to root + all admins."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, role, fname, lname FROM app_users WHERE email = :1 AND is_active = 1", [email])
    row = cursor.fetchone()
    if not row:
        cursor.close(); conn.close()
        raise HTTPException(status_code=404, detail="Email not found")

    user_id, role, fname, lname = int(row[0]), row[1], row[2], row[3]
    user_name = f"{fname} {lname}"
    code = _generate_code()
    expiry = datetime.now() + timedelta(minutes=10)

    cursor.execute("UPDATE app_users SET reset_code = :1, reset_code_expiry = :2 WHERE user_id = :3",
                   [code, expiry, user_id])
    conn.commit()

    # Determine recipients
    if role in ("root", "admin"):
        recipients = [email]
    else:
        cursor.execute("SELECT email FROM app_users WHERE role IN ('root', 'admin') AND is_active = 1")
        recipients = [r[0] for r in cursor.fetchall()]

    cursor.close()
    conn.close()

    # Send email with verification code
    email_sent = send_reset_code(recipients, code, user_name)

    return {
        "message": "Reset code sent" if email_sent else "Reset code generated but email delivery failed",
        "recipients": recipients,
        "user_id": user_id,
        "email_sent": email_sent
    }


def verify_reset_code(user_id: int, code: str, new_password: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT reset_code, reset_code_expiry FROM app_users WHERE user_id = :1", [user_id])
    row = cursor.fetchone()
    if not row or row[0] != code:
        cursor.close(); conn.close()
        raise HTTPException(status_code=400, detail="Invalid reset code")
    if row[1] and row[1] < datetime.now():
        cursor.close(); conn.close()
        raise HTTPException(status_code=400, detail="Reset code expired")

    cursor.execute("UPDATE app_users SET password_hash = :1, reset_code = NULL, reset_code_expiry = NULL WHERE user_id = :2",
                   [_hash_password(new_password), user_id])
    conn.commit()
    cursor.close()
    conn.close()
    return {"message": "Password reset successfully"}


def delete_user(user_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM app_users WHERE user_id = :1", [user_id])
    row = cursor.fetchone()
    if not row:
        cursor.close(); conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    if row[0] == "root":
        cursor.close(); conn.close()
        raise HTTPException(status_code=400, detail="Cannot delete root user")
    cursor.execute("DELETE FROM app_users WHERE user_id = :1", [user_id])
    conn.commit()
    cursor.close()
    conn.close()


def update_user(user_id: int, fields: dict):
    """Update user profile fields (fname, lname, mname, contact, email)."""
    if not fields:
        return
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check email uniqueness if changing email
        if "email" in fields:
            cursor.execute("SELECT COUNT(*) FROM app_users WHERE email = :1 AND user_id != :2", [fields["email"], user_id])
            if int(cursor.fetchone()[0]) > 0:
                raise HTTPException(status_code=400, detail="Email already in use")

        set_parts = []
        values = []
        for key in ("fname", "mname", "lname", "contact", "email"):
            if key in fields:
                set_parts.append(f"{key} = :{len(values)+1}")
                values.append(fields[key])
        if not set_parts:
            return
        values.append(user_id)
        sql = f"UPDATE app_users SET {', '.join(set_parts)} WHERE user_id = :{len(values)}"
        cursor.execute(sql, values)
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
