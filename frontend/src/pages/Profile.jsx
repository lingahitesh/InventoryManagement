import { useState, useEffect } from "react";
import "../styles/profile.css";
import { getUsers, createUser, deleteUser as deleteUserApi, changePassword, getUserPrivileges, updateUserPrivileges, updateUser } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import ModalOverlay from "../components/ModalOverlay";

const MODULES = [
    { key: "inventory", label: "Inventory", perms: ["view", "create", "edit", "delete"] },
    { key: "customer", label: "Customer List", perms: ["view", "create", "edit", "delete"] },
    { key: "sales_order", label: "Sales Orders", perms: ["view", "create", "edit", "delete", "generate", "status"] },
    { key: "purchase_order", label: "Purchase Orders", perms: ["view", "create", "edit", "delete", "generate", "status"] },
    { key: "dispatch", label: "Dispatch", perms: ["view", "create", "delete"] },
    { key: "payment", label: "Payment", perms: ["view", "create", "edit", "delete", "generate"] },
];

const PERMS = [
    { key: "view", label: "View" },
    { key: "create", label: "Create" },
    { key: "edit", label: "Edit" },
    { key: "delete", label: "Delete" },
    { key: "generate", label: "Generate" },
    { key: "status", label: "Status" },
];

function Profile({ currentUser, onLogout, onClose }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [editPrivsUser, setEditPrivsUser] = useState(null);

    // Inline edit state
    const [editing, setEditing] = useState(false);
    const [editingUserTarget, setEditingUserTarget] = useState(null); // for editing other users
    const [editForm, setEditForm] = useState({
        fname: currentUser.fname,
        mname: currentUser.mname || "",
        lname: currentUser.lname,
        contact: currentUser.contact,
        email: currentUser.email
    });
    const [editError, setEditError] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    const fetchUsers = async () => {
        try { setUsers(await getUsers()); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchUsers(); }, []);

    const canManageUsers = currentUser?.role === "root" || currentUser?.role === "admin";
    const isRoot = currentUser?.role === "root";

    // Filter users based on hierarchy (exclude self):
    // root sees all others, admin sees normal users only
    const visibleUsers = users.filter(u => {
        if (u.user_id === currentUser.user_id) return false; // never show self
        if (isRoot) return true;
        if (currentUser?.role === "admin") return u.role === "normal";
        return false;
    });

    /* ── Delete handler ─────────────────────────────────── */
    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteUserApi(deleteTarget.user_id);
            setDeleteTarget(null);
            fetchUsers();
        } catch (e) {
            alert(e.message);
            setDeleteTarget(null);
        }
    };

    /* ── Inline Edit handlers ──────────────────────────── */
    const startEdit = () => {
        setEditForm({
            fname: currentUser.fname,
            mname: currentUser.mname || "",
            lname: currentUser.lname,
            contact: currentUser.contact,
            email: currentUser.email
        });
        setEditError("");
        setEditing(true);
    };

    const cancelEdit = () => { setEditing(false); setEditError(""); };

    const saveEdit = async () => {
        if (!editForm.fname.trim()) { setEditError("First name is required"); return; }
        if (!editForm.lname.trim()) { setEditError("Last name is required"); return; }
        if (!editForm.contact.trim()) { setEditError("Contact is required"); return; }
        if (!editForm.email.trim()) { setEditError("Email is required"); return; }
        setEditSaving(true);
        setEditError("");
        try {
            await updateUser(currentUser.user_id, {
                fname: editForm.fname.trim(),
                mname: editForm.mname.trim() || null,
                lname: editForm.lname.trim(),
                contact: editForm.contact.trim(),
                email: editForm.email.trim()
            });
            // Update currentUser in-place (it's passed from parent, but we update visually)
            currentUser.fname = editForm.fname.trim();
            currentUser.mname = editForm.mname.trim() || null;
            currentUser.lname = editForm.lname.trim();
            currentUser.contact = editForm.contact.trim();
            currentUser.email = editForm.email.trim();
            setEditing(false);
        } catch (e) {
            setEditError(e.message);
        } finally {
            setEditSaving(false);
        }
    };

    /* ── Edit other user (opens a modal) ──────────────── */
    const startEditUser = (user) => {
        setEditingUserTarget({
            ...user,
            _form: { fname: user.fname, mname: user.mname || "", lname: user.lname, contact: user.contact, email: user.email }
        });
    };

    const saveEditUser = async () => {
        const u = editingUserTarget;
        const f = u._form;
        if (!f.fname.trim() || !f.lname.trim() || !f.contact.trim() || !f.email.trim()) return;
        try {
            await updateUser(u.user_id, {
                fname: f.fname.trim(), mname: f.mname.trim() || null,
                lname: f.lname.trim(), contact: f.contact.trim(), email: f.email.trim()
            });
            setEditingUserTarget(null);
            fetchUsers();
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <div className="profile-page">

            {/* ── Current User Info Card ─────────────────── */}
            <div className="profile-card">
                <div className="profile-avatar">
                    {currentUser.fname[0]}{currentUser.lname?.[0] || ""}
                </div>
                <div className="profile-info">
                    {!editing ? (
                        <>
                            <h2>
                                {currentUser.fname} {currentUser.mname || ""} {currentUser.lname}
                            </h2>
                            <div className="profile-role-row">
                                <span className={`role-badge role-${currentUser.role}`}>{currentUser.role}</span>
                                <button className="btn-edit-profile" onClick={startEdit} title="Edit Profile">✎</button>
                            </div>
                            <p className="profile-detail"><strong>Email:</strong> {currentUser.email}</p>
                            <p className="profile-detail"><strong>Contact:</strong> {currentUser.contact}</p>
                        </>
                    ) : (
                        <div className="profile-edit-form">
                            {editError && <div className="profile-edit-error">{editError}</div>}
                            <div className="profile-edit-row">
                                <input value={editForm.fname} onChange={e => setEditForm(f => ({ ...f, fname: e.target.value }))} placeholder="First Name" />
                                <input value={editForm.mname} onChange={e => setEditForm(f => ({ ...f, mname: e.target.value }))} placeholder="Middle Name" />
                                <input value={editForm.lname} onChange={e => setEditForm(f => ({ ...f, lname: e.target.value }))} placeholder="Last Name" />
                            </div>
                            <div className="profile-edit-row">
                                <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
                                <input value={editForm.contact} onChange={e => setEditForm(f => ({ ...f, contact: e.target.value }))} placeholder="Contact" />
                            </div>
                            <div className="profile-edit-actions">
                                <button className="submit-btn" onClick={saveEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save"}</button>
                                <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="profile-actions">
                    <button className="btn-change-pwd" onClick={() => setShowChangePassword(true)}>Change Password</button>
                    <button className="btn-logout" onClick={onLogout}>Logout</button>
                </div>
            </div>

            {/* ── User Management (root/admin only) ──────── */}
            {canManageUsers && (
                <div className="user-management">
                    <div className="um-header">
                        <h3>User Management</h3>
                        <button className="btn-create-user" onClick={() => setShowCreate(true)}>+ Create User</button>
                    </div>

                    {loading && <p className="um-loading">Loading users…</p>}
                    {error && <p className="um-error">{error}</p>}

                    {!loading && (
                        <div className="users-table-wrap">
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Contact</th>
                                        <th>Role</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleUsers.map(u => (
                                        <tr key={u.user_id}>
                                            <td>{u.fname} {u.mname || ""} {u.lname}</td>
                                            <td>{u.email}</td>
                                            <td>{u.contact}</td>
                                            <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                                            <td className="action-cell">
                                                {(isRoot || (currentUser.role === "admin" && u.role === "normal")) && (
                                                    <button className="btn-edit-user" onClick={() => startEditUser(u)} title="Edit">✎</button>
                                                )}
                                                {(isRoot || (currentUser.role === "admin" && u.role === "normal")) && (
                                                    <button className="btn-del" onClick={() => setDeleteTarget(u)} title="Delete">🗑</button>
                                                )}
                                                {u.role === "normal" && (
                                                    <button className="btn-privs" onClick={() => setEditPrivsUser(u)} title="Privileges">🛡</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Change Password Modal ──────────────────── */}
            {showChangePassword && (
                <ChangePasswordModal
                    userId={currentUser.user_id}
                    onClose={() => setShowChangePassword(false)}
                />
            )}

            {/* ── Create User Modal ──────────────────────── */}
            {showCreate && (
                <CreateUserModal
                    creatorRole={currentUser.role}
                    creatorId={currentUser.user_id}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); fetchUsers(); }}
                />
            )}

            {/* ── Edit Privileges Modal ──────────────────── */}
            {editPrivsUser && (
                <EditPrivilegesModal
                    user={editPrivsUser}
                    onClose={() => setEditPrivsUser(null)}
                    onSaved={() => { setEditPrivsUser(null); fetchUsers(); }}
                />
            )}

            {/* ── Delete Confirm ─────────────────────────── */}
            <ConfirmDialog
                open={!!deleteTarget}
                title="Delete User"
                message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.fname} ${deleteTarget.lname}"?` : ""}
                variant="danger"
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            {/* ── Edit User Modal ────────────────────────── */}
            {editingUserTarget && (
                <ModalOverlay open={true} title={`Edit User — ${editingUserTarget.fname} ${editingUserTarget.lname}`} onClose={() => setEditingUserTarget(null)}>
                    <div className="cu-form" style={{ maxWidth: 500, margin: "0 auto" }}>
                        <div className="cu-row">
                            <div className="cu-field">
                                <label>First Name *</label>
                                <input value={editingUserTarget._form.fname}
                                    onChange={e => setEditingUserTarget(u => ({ ...u, _form: { ...u._form, fname: e.target.value } }))} />
                            </div>
                            <div className="cu-field">
                                <label>Middle Name</label>
                                <input value={editingUserTarget._form.mname}
                                    onChange={e => setEditingUserTarget(u => ({ ...u, _form: { ...u._form, mname: e.target.value } }))} />
                            </div>
                            <div className="cu-field">
                                <label>Last Name *</label>
                                <input value={editingUserTarget._form.lname}
                                    onChange={e => setEditingUserTarget(u => ({ ...u, _form: { ...u._form, lname: e.target.value } }))} />
                            </div>
                        </div>
                        <div className="cu-row">
                            <div className="cu-field">
                                <label>Email *</label>
                                <input value={editingUserTarget._form.email}
                                    onChange={e => setEditingUserTarget(u => ({ ...u, _form: { ...u._form, email: e.target.value } }))} />
                            </div>
                            <div className="cu-field">
                                <label>Contact *</label>
                                <input value={editingUserTarget._form.contact}
                                    onChange={e => setEditingUserTarget(u => ({ ...u, _form: { ...u._form, contact: e.target.value } }))} />
                            </div>
                        </div>
                        <div className="cu-actions">
                            <button className="cancel-btn" onClick={() => setEditingUserTarget(null)}>Cancel</button>
                            <button className="submit-btn" onClick={saveEditUser}>Save Changes</button>
                        </div>
                    </div>
                </ModalOverlay>
            )}
        </div>
    );
}


/* ═══════════════════════════════════════════════════════════════
   Change Password Modal
   ═══════════════════════════════════════════════════════════════ */
function ChangePasswordModal({ userId, onClose }) {
    const [oldPwd, setOldPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!oldPwd.trim()) { setError("Current password is required"); return; }
        if (newPwd.length < 6) { setError("New password must be at least 6 characters"); return; }
        if (newPwd !== confirmPwd) { setError("Passwords do not match"); return; }
        setSubmitting(true);
        try {
            await changePassword(userId, oldPwd, newPwd);
            setSuccess(true);
            setTimeout(onClose, 1500);
        } catch (e) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalOverlay open={true} title="Change Password" onClose={onClose}>
            <form className="cpw-form" onSubmit={handleSubmit}>
                {success && <div className="cpw-success">Password changed successfully!</div>}
                {error && <div className="cpw-error">{error}</div>}
                <div className="cpw-field">
                    <label>Current Password</label>
                    <input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} autoFocus />
                </div>
                <div className="cpw-field">
                    <label>New Password</label>
                    <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                </div>
                <div className="cpw-field">
                    <label>Confirm New Password</label>
                    <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
                </div>
                <div className="cpw-actions">
                    <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button type="submit" className="submit-btn" disabled={submitting}>
                        {submitting ? "Changing…" : "Change Password"}
                    </button>
                </div>
            </form>
        </ModalOverlay>
    );
}


/* ═══════════════════════════════════════════════════════════════
   Create User Modal
   ═══════════════════════════════════════════════════════════════ */
function CreateUserModal({ creatorRole, creatorId, onClose, onCreated }) {
    const [form, setForm] = useState({
        fname: "", mname: "", lname: "",
        contact: "", email: "",
        password: "", confirmPassword: "",
        role: "normal"
    });
    const [privileges, setPrivileges] = useState(() => {
        const p = {};
        MODULES.forEach(m => { p[m.key] = { view: true, create: true, edit: true, delete: true, generate: true, status: true }; });
        return p;
    });
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const togglePerm = (module, perm) => {
        setPrivileges(prev => ({
            ...prev,
            [module]: { ...prev[module], [perm]: !prev[module][perm] }
        }));
    };

    const toggleModuleAll = (moduleKey) => {
        const mod = MODULES.find(m => m.key === moduleKey);
        const applicablePerms = mod ? mod.perms : PERMS.map(p => p.key);
        const allChecked = applicablePerms.every(pk => privileges[moduleKey]?.[pk]);
        setPrivileges(prev => ({
            ...prev,
            [moduleKey]: { ...prev[moduleKey], ...applicablePerms.reduce((acc, pk) => { acc[pk] = !allChecked; return acc; }, {}) }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        // Validation
        if (!form.fname.trim()) { setError("First name is required"); return; }
        if (!form.lname.trim()) { setError("Last name is required"); return; }
        if (!form.contact.trim()) { setError("Contact is required"); return; }
        if (!form.email.trim()) { setError("Email is required"); return; }
        if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
        if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
        // Admin can only create normal
        if (creatorRole === "admin" && form.role !== "normal") { setError("You can only create normal users"); return; }

        setSubmitting(true);
        try {
            await createUser({
                fname: form.fname.trim(),
                mname: form.mname.trim() || null,
                lname: form.lname.trim(),
                contact: form.contact.trim(),
                email: form.email.trim(),
                password: form.password,
                role: form.role,
                created_by: creatorId,
                privileges: form.role === "normal" ? privileges : null
            });
            onCreated();
        } catch (e) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalOverlay open={true} title="Create User" onClose={onClose}>
            <form className="cu-form" onSubmit={handleSubmit}>
                {error && <div className="cu-error">{error}</div>}

                <div className="cu-row">
                    <div className="cu-field">
                        <label>First Name *</label>
                        <input value={form.fname} onChange={e => handleChange("fname", e.target.value)} autoFocus />
                    </div>
                    <div className="cu-field">
                        <label>Middle Name</label>
                        <input value={form.mname} onChange={e => handleChange("mname", e.target.value)} />
                    </div>
                    <div className="cu-field">
                        <label>Last Name *</label>
                        <input value={form.lname} onChange={e => handleChange("lname", e.target.value)} />
                    </div>
                </div>

                <div className="cu-row">
                    <div className="cu-field">
                        <label>Contact *</label>
                        <input value={form.contact} onChange={e => handleChange("contact", e.target.value)} />
                    </div>
                    <div className="cu-field">
                        <label>Email *</label>
                        <input type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} />
                    </div>
                </div>

                <div className="cu-row">
                    <div className="cu-field">
                        <label>Password *</label>
                        <input type="password" value={form.password} onChange={e => handleChange("password", e.target.value)} />
                    </div>
                    <div className="cu-field">
                        <label>Confirm Password *</label>
                        <input type="password" value={form.confirmPassword} onChange={e => handleChange("confirmPassword", e.target.value)} />
                    </div>
                </div>

                {/* Role selector */}
                <div className="cu-field">
                    <label>Role *</label>
                    {creatorRole === "root" ? (
                        <select value={form.role} onChange={e => handleChange("role", e.target.value)}>
                            <option value="normal">Normal</option>
                            <option value="admin">Admin</option>
                        </select>
                    ) : (
                        <input value="Normal" disabled />
                    )}
                </div>

                {/* Privileges for normal users */}
                {form.role === "normal" && (
                    <div className="cu-privileges">
                        <h4>Privileges</h4>
                        <div className="privs-grid">
                            <div className="privs-header">
                                <span>Module</span>
                                {PERMS.map(p => <span key={p.key}>{p.label}</span>)}
                                <span>All</span>
                            </div>
                            {MODULES.map(m => (
                                <div className="privs-row" key={m.key}>
                                    <span className="privs-module-label">{m.label}</span>
                                    {PERMS.map(p => (
                                        <label key={p.key} className="privs-check">
                                            {m.perms.includes(p.key) ? (
                                                <input
                                                    type="checkbox"
                                                    checked={privileges[m.key]?.[p.key] ?? false}
                                                    onChange={() => togglePerm(m.key, p.key)}
                                                />
                                            ) : <span className="privs-na">—</span>}
                                        </label>
                                    ))}
                                    <label className="privs-check">
                                        <input
                                            type="checkbox"
                                            checked={m.perms.every(pk => privileges[m.key]?.[pk])}
                                            onChange={() => toggleModuleAll(m.key)}
                                        />
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="cu-actions">
                    <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button type="submit" className="submit-btn" disabled={submitting}>
                        {submitting ? "Creating…" : "Create User"}
                    </button>
                </div>
            </form>
        </ModalOverlay>
    );
}


/* ═══════════════════════════════════════════════════════════════
   Edit Privileges Modal
   ═══════════════════════════════════════════════════════════════ */
function EditPrivilegesModal({ user, onClose, onSaved }) {
    const [privileges, setPrivileges] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        getUserPrivileges(user.user_id)
            .then(privs => {
                // Ensure all modules have entries
                const full = {};
                MODULES.forEach(m => {
                    full[m.key] = privs[m.key] || { view: true, create: true, edit: true, delete: true, generate: true, status: true };
                });
                setPrivileges(full);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [user.user_id]);

    const togglePerm = (module, perm) => {
        setPrivileges(prev => ({
            ...prev,
            [module]: { ...prev[module], [perm]: !prev[module][perm] }
        }));
    };

    const toggleModuleAll = (moduleKey) => {
        const mod = MODULES.find(m => m.key === moduleKey);
        const applicablePerms = mod ? mod.perms : PERMS.map(p => p.key);
        const allChecked = applicablePerms.every(pk => privileges[moduleKey]?.[pk]);
        setPrivileges(prev => ({
            ...prev,
            [moduleKey]: { ...prev[moduleKey], ...applicablePerms.reduce((acc, pk) => { acc[pk] = !allChecked; return acc; }, {}) }
        }));
    };

    const handleSave = async () => {
        setSubmitting(true);
        setError("");
        try {
            await updateUserPrivileges(user.user_id, privileges);
            onSaved();
        } catch (e) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalOverlay open={true} title={`Privileges — ${user.fname} ${user.lname}`} onClose={onClose}>
            <div className="ep-content">
                {loading && <p>Loading…</p>}
                {error && <div className="ep-error">{error}</div>}
                {!loading && (
                    <>
                        <div className="privs-grid">
                            <div className="privs-header">
                                <span>Module</span>
                                {PERMS.map(p => <span key={p.key}>{p.label}</span>)}
                                <span>All</span>
                            </div>
                            {MODULES.map(m => (
                                <div className="privs-row" key={m.key}>
                                    <span className="privs-module-label">{m.label}</span>
                                    {PERMS.map(p => (
                                        <label key={p.key} className="privs-check">
                                            {m.perms.includes(p.key) ? (
                                                <input
                                                    type="checkbox"
                                                    checked={privileges[m.key]?.[p.key] ?? false}
                                                    onChange={() => togglePerm(m.key, p.key)}
                                                />
                                            ) : <span className="privs-na">—</span>}
                                        </label>
                                    ))}
                                    <label className="privs-check">
                                        <input
                                            type="checkbox"
                                            checked={m.perms.every(pk => privileges[m.key]?.[pk])}
                                            onChange={() => toggleModuleAll(m.key)}
                                        />
                                    </label>
                                </div>
                            ))}
                        </div>
                        <div className="ep-actions">
                            <button className="cancel-btn" onClick={onClose}>Cancel</button>
                            <button className="submit-btn" onClick={handleSave} disabled={submitting}>
                                {submitting ? "Saving…" : "Save Privileges"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </ModalOverlay>
    );
}

export default Profile;
