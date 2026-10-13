"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerModalProps {
  session: "checkin" | "worship" | "dinner";
  onClose: () => void;
  onScanSuccess: (scanResult: any) => void;
}

export default function QRScannerModal({ session, onClose, onScanSuccess }: QRScannerModalProps) {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastScannedResult, setLastScannedResult] = useState<any | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "html5qr-code-full-region";

  // Play audio check-in chime using Web Audio API
  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio playback fallback
    }
  };

  // Trigger vibration if available on mobile browser
  const triggerVibration = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  // Handle process scanned payload
  const handleProcessCode = async (rawCode: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rawCode, session }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to process QR code");
        setIsProcessing(false);
        return;
      }

      playSuccessChime();
      triggerVibration();
      setLastScannedResult(data);
      onScanSuccess(data);

      // Auto clear success card after 3 seconds to resume scanning
      setTimeout(() => {
        setIsProcessing(false);
      }, 3000);
    } catch (err: any) {
      setErrorMsg("Network error: " + (err.message || "Failed to check in"));
      setIsProcessing(false);
    }
  };

  // Initialize camera scanner
  useEffect(() => {
    let html5QrcodeScanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
          
          // Prefer environment / back camera on mobile phones
          const backCam = devices.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear") || d.label.toLowerCase().includes("environment"));
          const defaultCamId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(defaultCamId);

          html5QrcodeScanner = new Html5Qrcode(scannerContainerId);
          scannerRef.current = html5QrcodeScanner;

          await html5QrcodeScanner.start(
            defaultCamId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              handleProcessCode(decodedText);
            },
            () => {
              // Ignore scan frame errors
            }
          );
          setIsScanning(true);
        } else {
          setErrorMsg("No camera devices found on this device.");
        }
      } catch (err: any) {
        console.error("Camera init error:", err);
        setErrorMsg("Unable to access camera. Please allow camera permissions or try manual code entry.");
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
        });
      }
    };
  }, []);

  // Switch camera handler
  const handleCameraChange = async (newCamId: string) => {
    setSelectedCameraId(newCamId);
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.start(
          newCamId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => handleProcessCode(decodedText),
          () => {}
        );
      } catch (err) {
        console.error("Failed to switch camera:", err);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleProcessCode(manualCode.trim());
      setManualCode("");
    }
  };

  const sessionTitles: Record<string, string> = {
    checkin: "Arrival Check-in",
    worship: "Worship Session",
    dinner: "Dinner Check-in",
  };

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
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: "480px", width: "92%", padding: "0", borderRadius: "16px", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ background: "#0f172a", color: "#fff", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "700", color: "#6366f1", letterSpacing: "0.5px" }}>
              RECEPTIONIST CAMERA SCANNER
            </div>
            <h3 style={{ margin: "2px 0 0 0", fontSize: "18px", color: "#ffffff" }}>
              {sessionTitles[session] || "Session Check-in"}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "22px", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "20px", background: "#f8fafc" }}>
          
          {/* Camera controls */}
          {cameras.length > 1 && (
            <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Camera:</label>
              <select 
                value={selectedCameraId} 
                onChange={(e) => handleCameraChange(e.target.value)}
                className="input"
                style={{ fontSize: "12px", padding: "4px 8px", flex: 1 }}
              >
                {cameras.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Camera Viewport */}
          <div style={{ position: "relative", minHeight: "260px", background: "#000", borderRadius: "12px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div id={scannerContainerId} style={{ width: "100%", height: "100%" }} />

            {/* Success Overlay Card */}
            {lastScannedResult && isProcessing && (
              <div style={{
                position: "absolute",
                inset: 0,
                background: "rgba(15, 23, 42, 0.92)",
                backdropFilter: "blur(4px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                padding: "20px",
                textAlign: "center",
                zIndex: 10,
              }}>
                <div style={{ fontSize: "48px", marginBottom: "8px", animation: "bounce 0.5s ease" }}>
                  ✅
                </div>
                <div style={{ fontSize: "12px", color: "#4ade80", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>
                  {lastScannedResult.alreadyCheckedIn ? "ALREADY CHECKED IN" : "CHECK-IN SUCCESSFUL"}
                </div>
                <h3 style={{ margin: "4px 0 6px 0", fontSize: "22px", fontWeight: "700", color: "#fff" }}>
                  {lastScannedResult.family.name}
                </h3>
                <div style={{ fontSize: "14px", color: "#cbd5e1", marginBottom: "16px" }}>
                  {lastScannedResult.family.adults} Adults · {lastScannedResult.family.children} Children
                </div>
                <button 
                  type="button" 
                  className="btn primary"
                  onClick={() => setIsProcessing(false)}
                  style={{ fontSize: "13px", padding: "8px 16px" }}
                >
                  Scan Next Family 📷
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div style={{ marginTop: "12px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "8px", fontSize: "13px" }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Manual Entry Form */}
          <form onSubmit={handleManualSubmit} style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>
              Manual Pass ID / Search Code
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input 
                type="text" 
                className="input" 
                placeholder="Enter or paste Pass ID / Family ID..." 
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                style={{ flex: 1, fontSize: "13px" }}
              />
              <button type="submit" className="btn primary" disabled={isProcessing} style={{ fontSize: "13px" }}>
                Check In
              </button>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", background: "#f1f5f9", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
          <button type="button" className="btn" onClick={onClose} style={{ fontSize: "13px" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
