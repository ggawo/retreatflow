"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Logo from "@/components/Logo";

interface QRCodeModalProps {
  family: {
    id: string;
    name: string;
    leader: string;
    email: string;
    adults: number;
    children: number;
    nonPayingChildren?: number;
    status?: string;
    roomPref?: string;
  };
  eventName?: string;
  onClose: () => void;
}

export default function QRCodeModal({ family, eventName = "2026 Family Summer Retreat", onClose }: QRCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const isConfirmed = family.status === "Confirmed";
  const qrCodeText = `RETREATFLOW:FAM:${family.id}`;

  useEffect(() => {
    if (isConfirmed) {
      QRCode.toDataURL(
        qrCodeText,
        {
          width: 240,
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        },
        (error, url) => {
          if (error) console.error("Error generating QR code:", error);
          if (url) setQrDataUrl(url);
        }
      );
    }
  }, [qrCodeText, isConfirmed]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `${family.name.replace(/\s+/g, "_")}_QR_Pass.png`;
    link.href = qrDataUrl;
    link.click();
  };

  useEffect(() => {
    const onBefore = () => document.body.classList.add("printing-modal");
    const onAfter = () => document.body.classList.remove("printing-modal");
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint", onAfter);
      document.body.classList.remove("printing-modal");
    };
  }, []);

  const handlePrint = () => {
    document.body.classList.add("printing-modal");
    window.print();
  };

  if (!isConfirmed) {
    return (
      <div 
        className="modal-backdrop" 
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(15, 23, 42, 0.72)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px", padding: "24px", borderRadius: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "42px", marginBottom: "12px" }}>🚫</div>
          <h3 style={{ margin: "0 0 8px 0", color: "#0f172a", fontSize: "18px" }}>QR Pass Unavailable</h3>
          <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.5", margin: "0 0 20px 0" }}>
            QR Passes are only generated for <strong style={{ color: "#16a34a" }}>Confirmed</strong> registrations.
            <br />
            This family status is currently <strong style={{ color: "#d97706" }}>"{family.status || "Pending"}"</strong>.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="modal-backdrop print-modal-active" 
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div className="modal-content qr-modal-card single-qr-card qr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px", padding: "0", overflow: "hidden", borderRadius: "16px" }}>
        
        {/* Pass Header */}
        <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", color: "#fff", padding: "24px 24px 20px 24px", borderBottom: "3px solid #6366f1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <Logo size={42} showText={false} glow />
              <div>
                <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#818cf8" }}>
                  {eventName} PASS
                </div>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "22px", fontWeight: "800", color: "#ffffff" }}>
                  {family.name}
                </h2>
                <div style={{ fontSize: "13px", color: "#cbd5e1", marginTop: "2px", fontWeight: "500" }}>
                  Leader: {family.leader}
                </div>
              </div>
            </div>
            <button 
              className="no-print"
              onClick={onClose} 
              style={{ 
                background: "rgba(255, 255, 255, 0.06)", 
                border: "1px solid rgba(255, 255, 255, 0.12)", 
                color: "#94a3b8", 
                fontSize: "18px", 
                cursor: "pointer", 
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              title="Close modal"
              aria-label="Close modal"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.16)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Pass Body */}
        <div className="printable-pass-area" style={{ padding: "24px", background: "#ffffff", textAlign: "center" }}>
          
          <div className="print-pass-header" style={{ marginBottom: "16px", display: "none" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1.5px", color: "#6366f1" }}>
              {eventName} PASS
            </div>
            <h1 style={{ margin: "4px 0 2px 0", fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>
              {family.name}
            </h1>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#475569" }}>
              Leader: {family.leader}
            </div>
          </div>

          <div style={{ display: "inline-block", padding: "12px", background: "#f8fafc", borderRadius: "12px", border: "2px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            {qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt={`QR Pass for ${family.name}`} 
                width={220} 
                height={220} 
                style={{ display: "block", borderRadius: "8px", width: "220px", height: "220px", imageRendering: "pixelated" }} 
              />
            ) : (
              <div style={{ width: "220px", height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                Generating QR...
              </div>
            )}
          </div>

          <div style={{ marginTop: "14px", fontSize: "12px", fontFamily: "monospace", color: "#64748b", wordBreak: "break-all" }}>
            PASS ID: <span style={{ fontWeight: "700", color: "#0f172a" }}>{family.id}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", margin: "18px 0 10px 0", textAlign: "left", background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Attendees</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                {family.adults} {family.adults === 1 ? "Adult" : "Adults"}, {family.children} {family.children === 1 ? "Child" : "Children"}
                {family.nonPayingChildren ? `, ${family.nonPayingChildren} Free` : ""}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Status</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#16a34a" }}>
                ● Confirmed Pass
              </div>
            </div>
          </div>

          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "10px" }}>
            Present this QR code on arrival at RetreatFlow check-in.
          </div>
        </div>

        {/* Action Footer */}
        <div className="no-print" style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button 
            type="button" 
            className="btn" 
            onClick={handleDownload}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            📥 Save QR Image
          </button>
          <button 
            type="button" 
            className="btn primary" 
            onClick={handlePrint}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#0f172a" }}
          >
            🖨️ Print Pass
          </button>
        </div>
      </div>
    </div>
  );
}
