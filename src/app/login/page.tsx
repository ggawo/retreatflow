"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  
  // Sign In State
  const [signInEmail, setSignInEmail] = useState("admin@retreatflow.com");
  const [signInPassword, setSignInPassword] = useState("password");
  
  // Forgot Password State
  const [forgotStep, setForgotStep] = useState<"request" | "verify">("request");
  const [forgotEmail, setForgotEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devPasscodeNotice, setDevPasscodeNotice] = useState<string | null>(null);

  // Create Account State
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState("Church / Ministry");
  const [retreatName, setRetreatName] = useState("");
  const [startDate, setStartDate] = useState("2026-07-24");
  const [endDate, setEndDate] = useState("2026-07-26");
  const [location, setLocation] = useState("");
  const [pricePerAdult, setPricePerAdult] = useState("120");
  const [pricePerChild, setPricePerChild] = useState("60");
  const [childAgeThreshold, setChildAgeThreshold] = useState("12");
  const [fullPaymentDueDate, setFullPaymentDueDate] = useState("2026-07-20");
  const [hasDownpayment, setHasDownpayment] = useState(false);
  const [downpaymentAmount, setDownpaymentAmount] = useState("50");
  const [downpaymentDueDate, setDownpaymentDueDate] = useState("2026-07-10");
  const [registrationMode, setRegistrationMode] = useState<"PUBLIC_SELF" | "ADMIN_ONLY">("PUBLIC_SELF");
  const [registrationAccessCode, setRegistrationAccessCode] = useState("PASS2026");
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Cooldown timer for resending passcode
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Read URL query parameter ?mode=signup or ?mode=signin from landing page
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get("mode");
      if (urlMode === "signup" || urlMode === "signin" || urlMode === "forgot") {
        setMode(urlMode);
      }
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: signInEmail,
        password: signInPassword,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasscode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);
    setDevPasscodeNotice(null);

    const emailToUse = forgotEmail.trim();
    if (!emailToUse || !emailToUse.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unable to process password reset request.");
      } else {
        setSuccess(data.message || `A verification passcode was sent to ${emailToUse}.`);
        if (data.devPasscode) {
          setDevPasscodeNotice(`Local dev notice: Passcode is ${data.devPasscode} (logged to console / SMTP).`);
        }
        setForgotStep("verify");
        setResendCooldown(60);
      }
    } catch {
      setError("A network error occurred. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanPasscode = passcode.trim();
    if (!cleanPasscode || cleanPasscode.length < 6) {
      setError("Please enter the 6-digit passcode sent to your email.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter your password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          passcode: cleanPasscode,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password.");
      } else {
        setSuccess("Password updated successfully! Please sign in with your new password.");
        setSignInEmail(forgotEmail.trim());
        setSignInPassword("");
        setPasscode("");
        setNewPassword("");
        setConfirmPassword("");
        setDevPasscodeNotice(null);
        setMode("signin");
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!signUpName || !signUpEmail || !signUpPassword || !retreatName || !startDate || !location || !organizationName) {
      setError("Please fill out all required fields, including Organization Name.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signUpName,
          email: signUpEmail,
          password: signUpPassword,
          organizationName,
          organizationType,
          retreatName,
          startDate,
          endDate,
          location,
          pricePerAdult: Number(pricePerAdult),
          pricePerChild: Number(pricePerChild),
          childAgeThreshold: Number(childAgeThreshold),
          hasDownpayment,
          downpaymentAmount: Number(downpaymentAmount),
          downpaymentDueDate: hasDownpayment ? downpaymentDueDate : null,
          fullPaymentDueDate,
          registrationMode,
          registrationAccessCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Account creation failed.");
      } else {
        setSuccess("Retreat created successfully! A Welcome Email has been sent to your inbox. Signing you in...");
        const loginRes = await signIn("credentials", {
          email: signUpEmail,
          password: signUpPassword,
          redirect: false,
        });
        if (!loginRes?.error) {
          router.push("/");
          router.refresh();
        } else {
          setMode("signin");
          setSignInEmail(signUpEmail);
          setSignInPassword(signUpPassword);
        }
      }
    } catch {
      setError("Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Left Landing Hero Section (Collapses below on mobile) */}
      <div className="login-hero-section">
        <div style={{ maxWidth: "580px" }}>
          <div style={{ marginBottom: "24px" }}>
            <Logo size={64} textSize="36px" glow priority />
          </div>
          <h1 style={{ fontSize: "38px", fontWeight: "800", lineHeight: "1.25", marginBottom: "20px" }}>
            The Operating System for Retreats & Group Programs
          </h1>
          <p style={{ fontSize: "16px", color: "#94a3b8", lineHeight: "1.6", marginBottom: "32px" }}>
            Purpose-built for churches, schools, colleges, colleagues, and retreat centers. Manage housing, registrations, schedules, and branded communications without participant friction.
          </p>

          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ background: "#312e81", color: "#a5b4fc", padding: "6px 12px", borderRadius: "8px", fontWeight: "700" }}>✓</span>
              <div>
                <strong style={{ display: "block", fontSize: "15px" }}>Multi-Tenant Custom Co-Branding</strong>
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>Every email, report, badge, and check-in kiosk reflects your retreat and organization identity.</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ background: "#312e81", color: "#a5b4fc", padding: "6px 12px", borderRadius: "8px", fontWeight: "700" }}>✓</span>
              <div>
                <strong style={{ display: "block", fontSize: "15px" }}>Lodging, Matrix Housing & Kiosk</strong>
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>Dorm & cabin capacities, roommate requests, printable rosters, and QR self-check-in.</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ background: "#312e81", color: "#a5b4fc", padding: "6px 12px", borderRadius: "8px", fontWeight: "700" }}>✓</span>
              <div>
                <strong style={{ display: "block", fontSize: "15px" }}>Zero Attendee Login Friction</strong>
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>One admin manages each retreat. Participants receive dynamic confirmations and invoices directly.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sign In / Create Account / Forgot Password Section */}
      <div className="login-auth-section">
        <div className="login-card-inner">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <Logo size={42} showText={false} glow priority />
          </div>
          <div className="login-tabs-wrap">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}
              className={`login-tab-btn ${mode === "signin" ? "active" : ""}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}
              className={`login-tab-btn ${mode === "signup" ? "active" : ""}`}
            >
              Create Account
            </button>
            {mode === "forgot" && (
              <button
                type="button"
                className="login-tab-btn active"
                style={{ cursor: "default" }}
              >
                Reset Password
              </button>
            )}
          </div>

          <h2 style={{ fontSize: "24px", fontWeight: "800", margin: "0 0 6px" }}>
            {mode === "signin" && "Admin Sign In"}
            {mode === "signup" && "Create Account for Retreat"}
            {mode === "forgot" && (forgotStep === "request" ? "Reset Password" : "Verify & Set New Password")}
          </h2>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 20px" }}>
            {mode === "signin" && "Sign in to manage your retreat."}
            {mode === "signup" && "Set up your admin credentials, retreat details, and per-person pricing."}
            {mode === "forgot" && (
              forgotStep === "request"
                ? "Enter your registered email address. We will verify your account and email a 6-digit passcode."
                : `Enter the 6-digit passcode sent to ${forgotEmail} along with your new password.`
            )}
          </p>

          {error && (
            <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: "#14532d", color: "#86efac", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
              {success}
            </div>
          )}

          {devPasscodeNotice && (
            <div style={{ background: "#1e1b4b", color: "#c7d2fe", border: "1px solid #4338ca", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
              {devPasscodeNotice}
            </div>
          )}

          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="form">
              <div>
                <label style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: "600" }}>Admin Email</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="admin@retreatflow.com"
                  style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: "600" }}>Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setForgotStep("request");
                      setForgotEmail(signInEmail || "");
                      setError(null);
                      setSuccess(null);
                      setDevPasscodeNotice(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#818cf8",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: "500",
                      textDecoration: "underline"
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  className="input"
                  type="password"
                  required
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn primary login-submit-btn"
              >
                {loading ? "Authenticating..." : "Sign In to Dashboard"}
              </button>
            </form>
          )}

          {mode === "forgot" && forgotStep === "request" && (
            <form onSubmit={handleRequestPasscode} className="form">
              <div>
                <label style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: "600" }}>Registered Account Email</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="admin@retreatflow.com"
                  style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                />
                <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", lineHeight: "1.4" }}>
                  A 6-digit numeric verification passcode will only be sent if this email matches an active account.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn primary login-submit-btn"
              >
                {loading ? "Verifying Account..." : "Send Verification Passcode"}
              </button>

              <div style={{ textAlign: "center", marginTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: "13px",
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {mode === "forgot" && forgotStep === "verify" && (
            <form onSubmit={handleResetPassword} className="form">
              <div style={{
                background: "#1e293b",
                border: "1px solid #334155",
                padding: "10px 14px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Account: <b style={{ color: "#fff" }}>{forgotEmail}</b>
                </div>
                <button
                  type="button"
                  onClick={() => { setForgotStep("request"); setError(null); setSuccess(null); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#818cf8",
                    fontSize: "12px",
                    cursor: "pointer",
                    textDecoration: "underline",
                    flexShrink: 0
                  }}
                >
                  Change email
                </button>
              </div>

              <div>
                <label style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: "600" }}>6-Digit Passcode *</label>
                <input
                  className="input"
                  type="text"
                  maxLength={6}
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  style={{
                    background: "#1e293b",
                    borderColor: "#334155",
                    color: "#fff",
                    letterSpacing: "6px",
                    fontSize: "18px",
                    fontWeight: "700",
                    textAlign: "center"
                  }}
                />
              </div>

              <div>
                <label style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: "600" }}>New Password * (min. 6 chars)</label>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                />
              </div>

              <div>
                <label style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: "600" }}>Confirm New Password *</label>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn primary login-submit-btn"
              >
                {loading ? "Updating Password..." : "Update Password & Sign In"}
              </button>

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "14px",
                fontSize: "12px"
              }}>
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  ← Back to Sign In
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={() => handleRequestPasscode()}
                  style={{
                    background: "none",
                    border: "none",
                    color: resendCooldown > 0 ? "#64748b" : "#818cf8",
                    cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                    fontWeight: "600"
                  }}
                >
                  {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Resend Passcode"}
                </button>
              </div>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="form">
              <div style={{ fontWeight: "700", color: "#a5b4fc", fontSize: "13px", marginBottom: "4px" }}>
                1. Organizer & Organization Details
              </div>
              
              <div className="formgrid">
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Full Name *</label>
                  <input
                    className="input"
                    required
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="e.g. Marta Tekle"
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  />
                </div>
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Admin Email *</label>
                  <input
                    className="input"
                    type="email"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="coordinator@organization.org"
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  />
                </div>
              </div>

              <div className="formgrid">
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Organization / Group Name *</label>
                  <input
                    className="input"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g. Grace Fellowship, Lincoln High"
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  />
                </div>
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Organization Type</label>
                  <select
                    className="input select"
                    value={organizationType}
                    onChange={(e) => setOrganizationType(e.target.value)}
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  >
                    <option value="Church / Ministry">Church / Ministry</option>
                    <option value="School / University">School / University</option>
                    <option value="Corporate / Team">Corporate / Team</option>
                    <option value="Retreat Center / Camp">Retreat Center / Camp</option>
                    <option value="Non-Profit / NGO">Non-Profit / NGO</option>
                    <option value="Community Group">Community Group</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Password *</label>
                <input
                  className="input"
                  type="password"
                  required
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="Create admin password"
                  style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                />
              </div>

              <div style={{ fontWeight: "700", color: "#a5b4fc", fontSize: "13px", margin: "14px 0 4px" }}>
                2. Retreat Event Setup
              </div>

              <div>
                <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Retreat Title *</label>
                <input
                  className="input"
                  required
                  value={retreatName}
                  onChange={(e) => setRetreatName(e.target.value)}
                  placeholder="e.g. 2026 Annual Summer Retreat"
                  style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                />
              </div>

              <div className="formgrid">
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Start Date *</label>
                  <input
                    className="input"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  />
                </div>
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>End Date *</label>
                  <input
                    className="input"
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Venue / Camp Location *</label>
                <input
                  className="input"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Camp Hope, Pine Valley Retreat Center"
                  style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                />
              </div>

              <div style={{ fontWeight: "700", color: "#a5b4fc", fontSize: "13px", margin: "16px 0 6px" }}>
                3. Registration Workflow Preference *
              </div>
              <div className="reg-mode-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "8px" }}>
                <div
                  onClick={() => setRegistrationMode("PUBLIC_SELF")}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: `1.5px solid ${registrationMode === "PUBLIC_SELF" ? "#6366f1" : "#334155"}`,
                    background: registrationMode === "PUBLIC_SELF" ? "rgba(99, 102, 241, 0.14)" : "#1e293b",
                    cursor: "pointer",
                    boxShadow: registrationMode === "PUBLIC_SELF" ? "0 0 12px rgba(99, 102, 241, 0.25)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <input
                      type="radio"
                      id="mode_public"
                      name="registrationMode"
                      checked={registrationMode === "PUBLIC_SELF"}
                      onChange={() => setRegistrationMode("PUBLIC_SELF")}
                      style={{ cursor: "pointer", accentColor: "#6366f1" }}
                    />
                    <label htmlFor="mode_public" style={{ fontSize: "13px", fontWeight: "700", color: "#fff", cursor: "pointer" }}>
                      🌐 Public Self-Registration
                    </label>
                  </div>
                  <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", lineHeight: "1.4" }}>
                    Attendees self-register via a direct link. Auto fee calculation, dietary input & QR pass generation.
                  </p>
                </div>

                <div
                  onClick={() => setRegistrationMode("ADMIN_ONLY")}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: `1.5px solid ${registrationMode === "ADMIN_ONLY" ? "#6366f1" : "#334155"}`,
                    background: registrationMode === "ADMIN_ONLY" ? "rgba(99, 102, 241, 0.14)" : "#1e293b",
                    cursor: "pointer",
                    boxShadow: registrationMode === "ADMIN_ONLY" ? "0 0 12px rgba(99, 102, 241, 0.25)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <input
                      type="radio"
                      id="mode_admin"
                      name="registrationMode"
                      checked={registrationMode === "ADMIN_ONLY"}
                      onChange={() => setRegistrationMode("ADMIN_ONLY")}
                      style={{ cursor: "pointer", accentColor: "#6366f1" }}
                    />
                    <label htmlFor="mode_admin" style={{ fontSize: "13px", fontWeight: "700", color: "#fff", cursor: "pointer" }}>
                      🔒 Admin-Only Registration
                    </label>
                  </div>
                  <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", lineHeight: "1.4" }}>
                    Organizers enter attendees manually or upload spreadsheets. Public registration link is closed.
                  </p>
                </div>
              </div>

              {registrationMode === "PUBLIC_SELF" && (
                <div style={{ background: "#1e1b4b", border: "1px solid #4338ca", borderRadius: "8px", padding: "12px 14px", marginBottom: "12px" }}>
                  <label style={{ color: "#c7d2fe", fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                    🔒 Registration Access Passcode (Protects your link from unauthorized entries)
                  </label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      className="input"
                      value={registrationAccessCode}
                      onChange={(e) => setRegistrationAccessCode(e.target.value.toUpperCase())}
                      placeholder="e.g. PASS2026"
                      style={{ background: "#0f172a", borderColor: "#6366f1", color: "#34d399", fontWeight: "800", letterSpacing: "1px", maxWidth: "200px" }}
                    />
                    <span style={{ fontSize: "11px", color: "#94a3b8", flex: 1, minWidth: "220px" }}>
                      Only invited members with this code or the private invite link can register.
                    </span>
                  </div>
                </div>
              )}

              <div style={{ fontWeight: "700", color: "#a5b4fc", fontSize: "13px", margin: "16px 0 4px" }}>
                4. Participant Unit Pricing Rules
              </div>

              <div className="formgrid">
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Price per Adult ($)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={pricePerAdult}
                    onChange={(e) => setPricePerAdult(e.target.value)}
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  />
                </div>
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Price per Child ($)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={pricePerChild}
                    onChange={(e) => setPricePerChild(e.target.value)}
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  />
                </div>
              </div>

              <div className="formgrid">
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Child Age Threshold (Years)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={childAgeThreshold}
                    onChange={(e) => setChildAgeThreshold(e.target.value)}
                    placeholder="12 (children under this age)"
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  />
                </div>
                <div>
                  <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Full Payment Due Date *</label>
                  <input
                    className="input"
                    type="date"
                    required
                    value={fullPaymentDueDate}
                    onChange={(e) => setFullPaymentDueDate(e.target.value)}
                    style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                  />
                </div>
              </div>

              <div style={{ margin: "10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="hasDownpayment"
                  checked={hasDownpayment}
                  onChange={(e) => setHasDownpayment(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label htmlFor="hasDownpayment" style={{ color: "#cbd5e1", fontSize: "13px", cursor: "pointer", fontWeight: "600" }}>
                  Require optional downpayment / deposit
                </label>
              </div>

              {hasDownpayment && (
                <div className="formgrid">
                  <div>
                    <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Downpayment Amount ($)</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={downpaymentAmount}
                      onChange={(e) => setDownpaymentAmount(e.target.value)}
                      style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                    />
                  </div>
                  <div>
                    <label style={{ color: "#cbd5e1", fontSize: "12px" }}>Downpayment Due Date</label>
                    <input
                      className="input"
                      type="date"
                      value={downpaymentDueDate}
                      onChange={(e) => setDownpaymentDueDate(e.target.value)}
                      style={{ background: "#1e293b", borderColor: "#334155", color: "#fff" }}
                    />
                  </div>
                </div>
              )}

              {/* 4. Platform Tier & Stripe Readiness Card */}
              <div style={{
                background: "#1e1b4b",
                border: "1px solid #4338ca",
                borderRadius: "10px",
                padding: "16px",
                marginTop: "16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#a5b4fc" }}>
                      Selected Plan
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#ffffff" }}>
                      RetreatFlow Event Pass
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "18px", fontWeight: "900", color: "#34d399" }}>
                      $0.00
                    </div>
                    <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Free Dev / Launch Tier</span>
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: "1.5" }}>
                  ✓ 1 Admin Account for this Retreat<br/>
                  ✓ Housing & Dorm Matrix, Registration, Schedule & Kiosk<br/>
                  ✓ 60-Day Post-Retreat Grace Window + 1-Year Archive Access<br/>
                  ✓ Stripe Checkout Pre-Wired · Instant Dev Mode Activation
                </div>
                <div style={{ fontSize: "11px", color: "#a5b4fc", marginTop: "10px", fontStyle: "italic" }}>
                  📩 A Welcome Email with getting started instructions will be sent automatically to your admin email.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn primary login-submit-btn"
              >
                {loading ? "Activating Retreat..." : "✨ Activate Retreat Workspace (Free Trial)"}
              </button>
            </form>
          )}

          <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid #1e293b", fontSize: "12px", color: "#64748b", textAlign: "center" }}>
            Demo Exercise Admin: <b>admin@retreatflow.com</b> / <b>password</b>
          </div>
        </div>
      </div>
    </div>
  );
}
