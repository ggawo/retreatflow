"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Logo from "@/components/Logo";

interface BulkQRPrintModalProps {
  families: any[];
  eventName?: string;
  onClose: () => void;
}

function FamilyQRCard({ family, eventName }: { family: any; eventName: string }) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const qrCodeText = `RETREATFLOW:FAM:${family.id}`;

  useEffect(() => {
    QRCode.toDataURL(
      qrCodeText,
      {
        width: 160,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      },
      (err, url) => {
        if (!err && url) {
          setQrUrl(url);
        }
      }
    );
  }, [qrCodeText]);

  return (
    <div className="bulk-pass-card" style={{
      background: "#ffffff",
      border: "2px solid #0f172a",
      borderRadius: "14px",
      padding: "16px",
      textAlign: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      pageBreakInside: "avoid",
      breakInside: "avoid",
    }}>
      {/* Badge Header */}
      <div style={{ background: "#0f172a", color: "#ffffff", padding: "8px 12px", borderRadius: "8px 8px 6px 6px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#818cf8" }}>
            {eventName} PASS
          </div>
          <h3 style={{ margin: "2px 0 0 0", fontSize: "15px", fontWeight: "800", color: "#ffffff", lineHeight: "1.2" }}>
            {family.name}
          </h3>
          <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "1px" }}>
            Leader: {family.leader}
          </div>
        </div>
        <Logo size={26} showText={false} />
      </div>

      {/* QR Code Graphic (High Resolution Image) */}
      <div style={{ display: "inline-block", padding: "8px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
        {qrUrl ? (
          <img 
            src={qrUrl} 
            alt={`QR Code Pass for ${family.name}`} 
            width={160} 
            height={160} 
            style={{ display: "block", width: "160px", height: "160px", imageRendering: "pixelated" }} 
          />
        ) : (
          <div style={{ width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "12px" }}>
            Generating QR...
          </div>
        )}
      </div>

      <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#64748b", margin: "8px 0 6px 0" }}>
        PASS ID: <span style={{ fontWeight: "700", color: "#0f172a" }}>{family.id}</span>
      </div>

      <div style={{ fontSize: "11px", fontWeight: "700", color: "#0f172a", background: "#f1f5f9", padding: "6px 10px", borderRadius: "6px" }}>
        {family.adults} Adults, {family.children} Children {family.nonPayingChildren ? `(${family.nonPayingChildren} Free)` : ""}
        <span style={{ color: "#16a34a", marginLeft: "6px" }}>● Confirmed</span>
      </div>
    </div>
  );
}

export default function BulkQRPrintModal({ families, eventName = "2026 Family Summer Retreat", onClose }: BulkQRPrintModalProps) {
  const confirmedFamilies = families.filter(f => f.status === "Confirmed");

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
      <div 
        className="modal-content bulk-qr-modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: "860px", width: "95%", height: "88vh", display: "flex", flexDirection: "column", padding: "0", overflow: "hidden", borderRadius: "16px" }}
      >
        {/* Sticky Header */}
        <div style={{ background: "#0f172a", color: "#fff", padding: "16px 58px 16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          {/* Upper Right Corner Close Button */}
          <button 
            type="button" 
            onClick={onClose} 
            className="no-print"
            style={{ 
              position: "absolute",
              top: "14px",
              right: "16px",
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
              zIndex: 10,
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

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Logo size={32} showText={false} glow />
            <div>
              <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#818cf8" }}>
                BULK QR PASS PRINTING
              </div>
              <h2 style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "800", color: "#fff" }}>
                Confirmed Passes ({confirmedFamilies.length})
              </h2>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button 
              type="button" 
              className="btn primary" 
              onClick={handlePrint}
              disabled={confirmedFamilies.length === 0}
              style={{ backgroundColor: "#16a34a", color: "#fff", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "700" }}
            >
              🖨️ Print All {confirmedFamilies.length} Passes
            </button>
          </div>
        </div>

        {/* Scrollable Pass Area */}
        <div className="bulk-printable-area" style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#f8fafc" }}>
          {confirmedFamilies.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>ℹ️</div>
              <h3>No Confirmed Families</h3>
              <p>Only families with <strong>Confirmed</strong> status have active QR passes.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
              {confirmedFamilies.map(f => (
                <FamilyQRCard key={f.id} family={f} eventName={eventName} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="no-print" style={{ padding: "14px 24px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Total confirmed passes: <strong>{confirmedFamilies.length}</strong> (Pending & Waitlist excluded)
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
