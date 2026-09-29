import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authApi } from "../../utils/api";
import { isStrongPassword, passwordRequirements } from "../../utils/validation";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [verification, setVerification] = useState<"checking" | "valid" | "invalid">("checking");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordValid = isStrongPassword(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    let active = true;
    if (!token) {
      setVerification("invalid");
      setVerificationMessage("Invalid password reset link.");
      return () => { active = false; };
    }
    authApi.verifyResetToken(token)
      .then(() => { if (active) setVerification("valid"); })
      .catch((requestError: any) => {
        if (!active) return;
        setVerificationMessage(requestError.response?.data?.message || "This password reset link is invalid or has expired.");
        setVerification("invalid");
      });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => navigate("/login", { replace: true }), 4000);
    return () => window.clearTimeout(timer);
  }, [success, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (verification !== "valid") { setError("This password reset link is invalid or has expired."); return; }
    if (!isStrongPassword(password)) { setError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password, confirmPassword);
      setSuccess(true);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "This password reset link is no longer valid. Please request a new password reset link.");
    } finally { setLoading(false); }
  };

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(135deg, #5c1010, #9b3140)" }}>
    <section style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, padding: "38px 34px", boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
      <img src="/images/school-seal.png" alt="ICSQC" style={{ width: 52, height: 52, objectFit: "contain", marginBottom: 18 }} />
      {verification === "checking" ? <div style={{ textAlign: "center", color: "#6B7280" }}><LoaderCircle size={24} style={{ animation: "spin .8s linear infinite" }} /><p style={paragraphStyle}>Verifying your reset link...</p></div> : verification === "invalid" ? <>
        <AlertCircle size={34} color="#B91C1C" />
        <h1 style={headingStyle}>Reset Link Unavailable</h1>
        <p style={paragraphStyle}>{verificationMessage || "This password reset link is invalid or has expired."}</p>
        <button type="button" onClick={() => navigate("/login")} style={buttonStyle}>Back to Login</button>
      </> : success ? <>
        <CheckCircle size={34} color="#059669" />
        <h1 style={headingStyle}>Password Reset Successful</h1>
        <p style={paragraphStyle}>Your password has been updated successfully.</p>
        <button type="button" onClick={() => navigate("/login")} style={buttonStyle}>Return to Login</button>
      </> : <>
        <h1 style={headingStyle}>Create New Password</h1>
        <p style={paragraphStyle}>Choose a strong password for your ICSQC LMS account.</p>
        {error && <div style={{ display: "flex", gap: 7, padding: "11px 13px", marginBottom: 18, borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: ".82rem", lineHeight: 1.5 }}><AlertCircle size={15} />{error}</div>}
        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <PasswordField label="New Password" value={password} onChange={setPassword} shown={showPassword} toggle={() => setShowPassword(!showPassword)} />
          <PasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} shown={showConfirm} toggle={() => setShowConfirm(!showConfirm)} />
          <div style={{ display: "flex", gap: 4 }} aria-label={`Password strength: ${passwordValid ? "strong" : password.length ? "in progress" : "empty"}`}>
            {passwordRequirements.map((item, index) => {
              const passed = [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)][index];
              return <span key={item} style={{ height: 4, flex: 1, borderRadius: 4, background: passed ? "#059669" : "#E5E7EB" }} />;
            })}
          </div>
          <div style={{ color: "#6B7280", fontSize: ".78rem", lineHeight: 1.7 }}><strong>Password requirements:</strong>{passwordRequirements.map((item, index) => {
            const passed = [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)][index];
            return <div key={item} style={{ color: passed ? "#047857" : undefined }}>{passed ? "✓" : "•"} {item}</div>;
          })}
          {confirmPassword.length > 0 && <div style={{ color: passwordsMatch ? "#047857" : "#B91C1C" }}>{passwordsMatch ? "✓ Passwords match" : "• Passwords must match"}</div>}</div>
          <button type="submit" disabled={loading || !passwordValid || !passwordsMatch} style={{ ...buttonStyle, opacity: loading || !passwordValid || !passwordsMatch ? 0.55 : 1, cursor: loading || !passwordValid || !passwordsMatch ? "not-allowed" : "pointer" }}>{loading ? "Resetting..." : "Reset Password"}</button>
        </form>
        <Link to="/forgot-password" style={{ display: "block", textAlign: "center", marginTop: 20, color: "#7a1010", fontSize: ".85rem" }}>Request New Reset Link</Link>
      </>}
    </section>
  </main>;
}

function PasswordField({ label, value, onChange, shown, toggle }: { label: string; value: string; onChange: (value: string) => void; shown: boolean; toggle: () => void }) {
  return <label style={{ display: "block", color: "#374151", fontSize: ".8rem", fontWeight: 600 }}>{label}<div style={{ position: "relative", marginTop: 7 }}><input aria-label={label} required type={shown ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} /><button type="button" onClick={toggle} aria-label={shown ? "Hide password" : "Show password"} style={eyeStyle}>{shown ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>;
}

const headingStyle = { margin: "12px 0 8px", color: "#111827", fontSize: "1.45rem" };
const paragraphStyle = { margin: "0 0 24px", color: "#6B7280", lineHeight: 1.6, fontSize: ".9rem" };
const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "11px 42px 11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 8, color: "#111827", fontSize: ".9rem" };
const eyeStyle = { position: "absolute" as const, right: 11, top: 10, border: 0, background: "transparent", color: "#6B7280", cursor: "pointer" };
const buttonStyle = { width: "100%", padding: 12, border: 0, borderRadius: 8, background: "#7a1010", color: "#fff", fontWeight: 700, cursor: "pointer" };
