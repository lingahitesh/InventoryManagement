from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from backend.services.auth_service import (
    authenticate, get_user, get_all_users, create_user,
    get_user_privileges, update_user_privileges,
    change_password, request_password_reset, verify_reset_code, delete_user
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: str
    password: str


class CreateUserBody(BaseModel):
    fname: str
    mname: Optional[str] = None
    lname: str
    contact: str
    email: str
    password: str
    role: str  # admin or normal
    created_by: int
    privileges: Optional[Dict] = None


class ChangePasswordBody(BaseModel):
    user_id: int
    old_password: str
    new_password: str


class ResetRequestBody(BaseModel):
    email: str


class ResetVerifyBody(BaseModel):
    user_id: int
    code: str
    new_password: str


@router.post("/login")
def login(body: LoginBody):
    user = authenticate(body.email, body.password)
    privs = get_user_privileges(user["user_id"])
    return {"user": user, "privileges": privs}


@router.get("/users")
def list_users():
    return get_all_users()


@router.get("/users/{user_id}")
def fetch_user(user_id: int):
    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/users")
def add_user(body: CreateUserBody):
    user_id = create_user(
        body.fname, body.mname, body.lname, body.contact,
        body.email, body.password, body.role, body.created_by, body.privileges
    )
    return {"message": "User created", "user_id": user_id}


@router.get("/users/{user_id}/privileges")
def fetch_privileges(user_id: int):
    return get_user_privileges(user_id)


@router.put("/users/{user_id}/privileges")
def set_privileges(user_id: int, body: dict):
    update_user_privileges(user_id, body)
    return {"message": "Privileges updated"}


class UpdateUserBody(BaseModel):
    fname: Optional[str] = None
    lname: Optional[str] = None
    mname: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None


@router.put("/users/{user_id}")
def update_user_endpoint(user_id: int, body: UpdateUserBody):
    from backend.services.auth_service import update_user
    update_user(user_id, body.model_dump(exclude_none=True))
    return {"message": "User updated"}


@router.post("/change-password")
def change_pwd(body: ChangePasswordBody):
    change_password(body.user_id, body.old_password, body.new_password)
    return {"message": "Password changed"}


@router.post("/reset-request")
def reset_request(body: ResetRequestBody):
    return request_password_reset(body.email)


@router.post("/reset-verify")
def reset_verify(body: ResetVerifyBody):
    return verify_reset_code(body.user_id, body.code, body.new_password)


@router.delete("/users/{user_id}")
def remove_user(user_id: int):
    delete_user(user_id)
    return {"message": "User deleted"}
