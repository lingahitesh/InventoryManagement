import { useState } from "react";
import "../styles/login.css";

function Login({ onLogin })
{
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState({});
    const [authError, setAuthError] = useState("");

    const handleSubmit = (e) =>
    {
        e.preventDefault();

        const newErrors = {};
        setAuthError("");

        if(!username.trim())
        {
            newErrors.username = "Username is required";
        }

        if(!password.trim())
        {
            newErrors.password = "Password is required";
        }

        if(Object.keys(newErrors).length > 0)
        {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        if(username === "admin" && password === "admin")
        {
            onLogin();
        }
        else
        {
            setAuthError("Invalid username or password");
        }
    };

    return (
        <div className="login-page">

            <div className="login-card">

                <h1 className="login-title">Login</h1>

                <form onSubmit={handleSubmit}>

                    <div className="login-field">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            maxLength={50}
                            placeholder="Enter username"
                            value={username}
                            onChange={(e) =>
                                setUsername(e.target.value)
                            }
                        />
                        {errors.username && (
                            <span className="field-error">
                                {errors.username}
                            </span>
                        )}
                    </div>

                    <div className="login-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            maxLength={128}
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) =>
                                setPassword(e.target.value)
                            }
                        />
                        {errors.password && (
                            <span className="field-error">
                                {errors.password}
                            </span>
                        )}
                    </div>

                    {authError && (
                        <div className="auth-error">
                            {authError}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-btn"
                    >
                        Login
                    </button>

                </form>

            </div>

        </div>
    );
}

export default Login;
