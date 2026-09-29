import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, LoaderCircle, Mail } from "lucide-react";
import { authApi } from "../../utils/api";
import { isIcsqcEmail } from "../../utils/validation";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!isIcsqcEmail(normalizedEmail)) {
      setError("Enter a valid ICSQC email address.");
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.forgotPassword(normalizedEmail);
      const successMessage = "If an account with that email exists, we've sent a password reset link to your email.";
      setMessage(successMessage);
      toast.success(successMessage);
    } catch (requestError: any) {
      const errorMessage = requestError.response?.data?.message || "Network error. Please check your connection and try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="Forgot Password" subtitle="Enter your registered ICSQC email address and we'll send you a password reset link.">
      {message && <div style={noticeStyle("#ECFDF5", "#047857")}>{message}</div>}
      {error && <div style={noticeStyle("#FEF2F2", "#B91C1C")}><AlertCircle size={15} />{error}</div>}
      <form onSubmit={submit} style={{ display: "grid", gap: 18 }}>
        <label style={labelStyle}>
          <div style={{ position: "relative", marginTop: 7 }}>
            <Mail size={16} style={{ position: "absolute", left: 13, top: 13, color: "#9CA3AF" }} />
            <input aria-label="Enter your email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" style={inputStyle} />
          </div>
        </label>
        <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? <><LoaderCircle size={16} style={{ verticalAlign: "middle", marginRight: 8, animation: "spin .8s linear infinite" }} />Sending...</> : "Send Reset Link"}
        </button>
      </form>
      <Link to="/login" style={backStyle}><ArrowLeft size={15} /> Back to Login</Link>
    </AuthFrame>
  );
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "linear-gradient(135deg, #5c1010, #9b3140)" }}>
    <section style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: "38px 34px", boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
      <img src="/images/school-seal.png" alt="ICSQC" style={{ width: 52, height: 52, objectFit: "contain", marginBottom: 18 }} />
      <h1 style={{ margin: "0 0 8px", color: "#111827", fontSize: "1.45rem" }}>{title}</h1>
      <p style={{ margin: "0 0 26px", color: "#6B7280", lineHeight: 1.6, fontSize: ".9rem" }}>{subtitle}</p>
      {children}
    </section>
  </main>;
}

const labelStyle = { display: "block", color: "#374151", fontSize: ".8rem", fontWeight: 600 } as const;
const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "11px 14px 11px 40px", border: "1.5px solid #E5E7EB", borderRadius: 8, color: "#111827", fontSize: ".9rem" };
const buttonStyle = { width: "100%", padding: 12, border: 0, borderRadius: 8, background: "#7a1010", color: "#fff", fontWeight: 700, cursor: "pointer" };
const backStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 22, color: "#7a1010", fontSize: ".85rem", textDecoration: "none" };
const noticeStyle = (background: string, color: string) => ({ display: "flex", alignItems: "center", gap: 7, padding: "11px 13px", marginBottom: 18, borderRadius: 8, background, color, fontSize: ".82rem", lineHeight: 1.5 });
