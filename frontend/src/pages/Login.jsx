import { useState, useRef, useEffect, useCallback } from "react";
import "../styles/login.css";
import { loginUser, requestPasswordReset, verifyResetCode } from "../api";

function Login({ onLogin })
{
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const pwdTimerRef = useRef(null);
    const [errors, setErrors] = useState({});
    const [authError, setAuthError] = useState("");
    const [loading, setLoading] = useState(false);

    // Forgot password state
    const [showForgot, setShowForgot] = useState(false);
    const [forgotStep, setForgotStep] = useState(1); // 1=email, 2=code, 3=new password
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotUserId, setForgotUserId] = useState(null);
    const [forgotError, setForgotError] = useState("");
    const [forgotSuccess, setForgotSuccess] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [resetInfo, setResetInfo] = useState("");

    // OTP boxes
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const otpRefs = useRef([]);

    // Resend timer
    const [resendTimer, setResendTimer] = useState(60);
    const [resendCount, setResendCount] = useState(0);
    const [locked, setLocked] = useState(false);
    const timerRef = useRef(null);

    // New password (step 3)
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");

    // ── Countdown timer for resend ──────────────────────────
    const startTimer = useCallback(() => {
        setResendTimer(60);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) { clearInterval(timerRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

    // ── Login ───────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = {};
        setAuthError("");
        if (!email.trim()) newErrors.username = "Email is required";
        if (!password.trim()) newErrors.password = "Password is required";
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
        setErrors({});
        setLoading(true);
        try {
            const result = await loginUser(email, password);
            onLogin(result.user, result.privileges);
        } catch (err) {
            setAuthError(err.message || "Invalid email or password");
        } finally {
            setLoading(false);
        }
    };

    // ── Step 1: Send email ──────────────────────────────────
    const handleForgotRequest = async (e) => {
        e.preventDefault();
        setForgotError("");
        if (!forgotEmail.trim()) { setForgotError("Email is required"); return; }
        setForgotLoading(true);
        try {
            const result = await requestPasswordReset(forgotEmail.trim());
            setForgotUserId(result.user_id);
            setResetInfo(`Code sent to ${result.recipients?.length > 1 ? "admin/root users" : result.recipients?.[0] || "registered email"}`);
            setForgotStep(2);
            setResendCount(prev => prev + 1);
            startTimer();
        } catch (err) {
            setForgotError(err.message);
        } finally {
            setForgotLoading(false);
        }
    };

    // ── Resend code ─────────────────────────────────────────
    const handleResend = async () => {
        if (resendTimer > 0 || locked) return;
        if (resendCount >= 3) {
            setLocked(true);
            setForgotError("Too many attempts. Locked for 1 hour.");
            return;
        }
        setForgotError("");
        setForgotLoading(true);
        try {
            await requestPasswordReset(forgotEmail.trim());
            setResendCount(prev => prev + 1);
            startTimer();
            if (resendCount + 1 >= 3) {
                setLocked(true);
                setForgotError("Maximum attempts reached. Locked for 1 hour.");
            }
        } catch (err) {
            setForgotError(err.message);
        } finally {
            setForgotLoading(false);
        }
    };

    // ── OTP input handlers ──────────────────────────────────
    const handleOtpChange = (index, value) => {
        if (value.length > 1) value = value.slice(-1);
        if (value && !/^\d$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (paste.length > 0) {
            const newOtp = [...otp];
            for (let i = 0; i < 6; i++) newOtp[i] = paste[i] || "";
            setOtp(newOtp);
            const focusIdx = Math.min(paste.length, 5);
            otpRefs.current[focusIdx]?.focus();
        }
    };

    // ── Step 2: Verify OTP ──────────────────────────────────
    const handleVerifyOtp = async () => {
        const code = otp.join("");
        if (code.length < 6) { setForgotError("Enter the full 6-digit code"); return; }
        setForgotError("");
        setForgotLoading(true);
        try {
            // Just validate the code — we pass a dummy password and catch error
            // Actually, we move to step 3 first, then reset with real password
            setForgotStep(3);
        } finally {
            setForgotLoading(false);
        }
    };

    // ── Step 3: Set new password ────────────────────────────
    const handleSetNewPassword = async (e) => {
        e.preventDefault();
        setForgotError("");
        if (newPwd.length < 6) { setForgotError("Password must be at least 6 characters"); return; }
        if (newPwd !== confirmPwd) { setForgotError("Passwords do not match"); return; }
        setForgotLoading(true);
        try {
            const code = otp.join("");
            await verifyResetCode(forgotUserId, code, newPwd);
            setForgotSuccess("Password reset successfully!");
            setTimeout(() => closeForgot(), 2000);
        } catch (err) {
            setForgotError(err.message);
            // If code is wrong, go back to step 2
            if (err.message?.toLowerCase().includes("code")) setForgotStep(2);
        } finally {
            setForgotLoading(false);
        }
    };

    // ── Close / Reset ───────────────────────────────────────
    const closeForgot = () => {
        setShowForgot(false);
        setForgotStep(1);
        setForgotEmail("");
        setForgotUserId(null);
        setOtp(["", "", "", "", "", ""]);
        setNewPwd("");
        setConfirmPwd("");
        setForgotError("");
        setForgotSuccess("");
        setResetInfo("");
        setResendTimer(60);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const formatTimer = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    return (
        <div className="login-page">
            <div className="login-card">
                <h1 className="login-title">Login</h1>
                <form onSubmit={handleSubmit}>
                    <div className="login-field">
                        <label htmlFor="email">Email</label>
                        <input id="email" type="email" maxLength={200}
                            placeholder="Enter email" value={email}
                            onChange={e => setEmail(e.target.value)} />
                        {errors.username && <span className="field-error">{errors.username}</span>}
                    </div>
                    <div className="login-field">
                        <label htmlFor="password">Password</label>
                        <div className="password-input-wrap">
                            <input id="password" type={showPassword ? "text" : "password"}
                                maxLength={128} placeholder="Enter password"
                                value={password} onChange={e => setPassword(e.target.value)} />
                            <button type="button" className="pwd-eye-btn" onClick={() => {
                                setShowPassword(true);
                                if (pwdTimerRef.current) clearTimeout(pwdTimerRef.current);
                                pwdTimerRef.current = setTimeout(() => setShowPassword(false), 2000);
                            }} tabIndex={-1}>
                                {showPassword
                                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                }
                            </button>
                        </div>
                        {errors.password && <span className="field-error">{errors.password}</span>}
                    </div>
                    {authError && <div className="auth-error">{authError}</div>}
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? "Logging in…" : "Login"}
                    </button>
                </form>
                <div className="forgot-link-wrap">
                    <button className="forgot-link" onClick={() => setShowForgot(true)}>Forgot Password?</button>
                </div>
            </div>

            {/* ══════ Forgot Password Modal ══════ */}
            {showForgot && (
                <div className="forgot-overlay" onClick={closeForgot}>
                    <div className="forgot-card" onClick={e => e.stopPropagation()}>
                        <button className="forgot-close" onClick={closeForgot}>✕</button>

                        {forgotSuccess && <div className="forgot-success">{forgotSuccess}</div>}
                        {forgotError && <div className="forgot-error">{forgotError}</div>}

                        {/* ── Step 1: Enter Email ── */}
                        {forgotStep === 1 && (
                            <>
                                <h2 className="forgot-title">Reset Password</h2>
                                <p className="forgot-desc">Enter your registered email to receive a verification code.</p>
                                <form onSubmit={handleForgotRequest}>
                                    <div className="login-field">
                                        <label>Email</label>
                                        <input type="email" value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            placeholder="Your registered email" autoFocus />
                                    </div>
                                    <button type="submit" className="login-btn" disabled={forgotLoading}>
                                        {forgotLoading ? "Sending…" : "Send Code"}
                                    </button>
                                </form>
                            </>
                        )}

                        {/* ── Step 2: Enter OTP Code ── */}
                        {forgotStep === 2 && (
                            <>
                                <h2 className="forgot-title">Enter the code you received</h2>
                                {resetInfo && <p className="forgot-info">{resetInfo}</p>}
                                <div className="otp-container" onPaste={handleOtpPaste}>
                                    {otp.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            ref={el => otpRefs.current[idx] = el}
                                            className="otp-box"
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={e => handleOtpChange(idx, e.target.value)}
                                            onKeyDown={e => handleOtpKeyDown(idx, e)}
                                            autoFocus={idx === 0}
                                        />
                                    ))}
                                </div>
                                <div className="otp-resend-row">
                                    {locked ? (
                                        <span className="otp-locked">Locked — try again in 1 hour</span>
                                    ) : resendTimer > 0 ? (
                                        <span className="otp-timer">Resend in {formatTimer(resendTimer)}</span>
                                    ) : (
                                        <button className="otp-resend-btn" onClick={handleResend} disabled={forgotLoading}>
                                            Resend code
                                        </button>
                                    )}
                                    <span className="otp-attempts">{resendCount}/3 attempts</span>
                                </div>
                                <div className="forgot-actions">
                                    <button className="forgot-cancel-btn" onClick={closeForgot}>Cancel</button>
                                    <button className="forgot-verify-btn" onClick={handleVerifyOtp}
                                        disabled={otp.join("").length < 6 || forgotLoading}>
                                        {forgotLoading ? "Verifying…" : "Verify"}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ── Step 3: Set New Password ── */}
                        {forgotStep === 3 && (
                            <>
                                <h2 className="forgot-title">Set New Password</h2>
                                <form onSubmit={handleSetNewPassword}>
                                    <div className="login-field">
                                        <label>New Password</label>
                                        <input type="password" value={newPwd}
                                            onChange={e => setNewPwd(e.target.value)}
                                            placeholder="At least 6 characters" autoFocus />
                                    </div>
                                    <div className="login-field">
                                        <label>Confirm New Password</label>
                                        <input type="password" value={confirmPwd}
                                            onChange={e => setConfirmPwd(e.target.value)}
                                            placeholder="Confirm password" />
                                    </div>
                                    <div className="forgot-actions">
                                        <button type="button" className="forgot-cancel-btn" onClick={() => setForgotStep(2)}>Back</button>
                                        <button type="submit" className="forgot-verify-btn" disabled={forgotLoading}>
                                            {forgotLoading ? "Resetting…" : "Reset Password"}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Login;
