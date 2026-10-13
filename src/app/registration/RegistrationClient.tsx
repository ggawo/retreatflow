"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCodeModal from "@/components/QRCodeModal";
import BulkQRPrintModal from "@/components/BulkQRPrintModal";
import ActionDropdown, { ActionDropdownItem } from "@/components/ActionDropdown";

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line: string) => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim().replace(/^"(.*)"$/, "$1"));
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^"(.*)"$/, "$1"));
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  const records: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (vals.length < 2) continue;

    const getVal = (keys: string[], defaultVal: string = "") => {
      for (const k of keys) {
        const idx = headers.findIndex(h => h.includes(k));
        if (idx !== -1 && vals[idx] !== undefined && vals[idx] !== "") return vals[idx];
      }
      return defaultVal;
    };

    const name = getVal(["name", "family", "group"], "");
    const leader = getVal(["leader", "contact", "primary"], "");
    const email = getVal(["email", "mail"], "");

    if (!name && !leader && !email) continue;

    records.push({
      name: name || `Family ${i}`,
      leader: leader || name || `Leader ${i}`,
      email: email || `contact${i}@example.com`,
      phone: getVal(["phone", "mobile", "cell"], ""),
      adults: Number(getVal(["adults", "adult"], "1")) || 1,
      children: Number(getVal(["payingchildren", "children", "child"], "0")) || 0,
      nonPayingChildren: Number(getVal(["nonpayingchildren", "freechildren", "infant"], "0")) || 0,
      roomPref: getVal(["roompreference", "roompref", "room"], "Any"),
      access: getVal(["accessibility", "access", "needs"], "None"),
      status: getVal(["status"], "Confirmed") || "Confirmed",
      notes: getVal(["notes", "note", "dietary"], ""),
    });
  }

  return records;
}

export default function RegistrationClient({ initialData, event }: { initialData: any[]; event?: any }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const [toast, setToast] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [parsedBulkData, setParsedBulkData] = useState<any[]>([]);
  const [qrFamilyModal, setQrFamilyModal] = useState<any | null>(null);
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);

  const router = useRouter();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const copyPublicLink = () => {
    if (typeof window === "undefined") return;
    const slug = event?.slug || "summer-retreat-2026";
    const codeParam = event?.requireAccessCode && event?.registrationAccessCode ? `?code=${event.registrationAccessCode.trim().toUpperCase()}` : "";
    const url = `${window.location.origin}/r/${slug}${codeParam}`;
    navigator.clipboard.writeText(url);
    showToast("✓ Protected registration invite link copied!");
  };

  const filteredData = data.filter((r) => {
    const hay = `${r.family?.name} ${r.family?.email} ${r.source}`.toLowerCase();
    return (!query || hay.includes(query.toLowerCase())) &&
      (statusFilter === "all" || r.status === statusFilter);
  });

  const attentionReg = data.filter(r => r.completeness < 100 || !r.waiver || r.status === "Waitlist").length;

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    if (res.ok) {
      setData(prev => prev.map(r => r.id === id ? { ...r, status: "Confirmed" } : r));
      showToast("Registration approved successfully.");
      router.refresh();
    } else {
      const err = await res.json();
      showToast(err.error || "Approval failed.");
    }
  };

  const [reminding, setReminding] = useState(false);

  const handleRemind = async (familyName: string) => {
    setReminding(true);
    showToast(`Sending registration reminder email to ${familyName}...`);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: familyName,
          subject: `Action Required: Incomplete Registration for ${familyName}`,
          body: "Please sign missing liability waivers and complete remaining attendee details.",
          sendEmail: true,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        const count = result.delivery?.sentCount ?? 1;
        showToast(`✅ Registration reminder delivered to ${count} family email(s)!`);
      } else {
        showToast(result.error || "Error sending registration reminder.");
      }
    } catch {
      showToast("Error connecting to notification service.");
    } finally {
      setReminding(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const records = parseCSV(text);
        setParsedBulkData(records);
        if (records.length === 0) {
          showToast("Could not parse valid family records from CSV.");
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSaveBulk = async () => {
    if (parsedBulkData.length === 0) return;
    try {
      const res = await fetch("/api/families/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedBulkData),
      });

      if (res.ok) {
        const result = await res.json();
        showToast(`${result.count} families imported successfully!`);
        setShowBulkModal(false);
        setParsedBulkData([]);
        setBulkFileName("");
        router.refresh();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed bulk registration.");
      }
    } catch {
      showToast("Error performing bulk registration.");
    }
  };

  const handleDownloadTemplate = () => {
    const template = "Name,Leader,Email,Phone,Adults,PayingChildren,NonPayingChildren,RoomPreference,Accessibility,Status,Notes\n" +
      '"Johnson Family","Mark Johnson","mark@example.com","555-0199",2,1,0,"Ground floor","None","Confirmed","Vegetarian meals"\n' +
      '"Grace Youth Group","Sarah Miller","sarah@example.com","555-0244",4,2,1,"Near chapel","Wheelchair access","Pending","Late arrival on Friday"';
    
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + template);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "retreatflow_bulk_registration_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded CSV template!");
  };

  const registrationActions: ActionDropdownItem[] = [
    {
      id: "share-public-link",
      label: "Copy Public Registration Link",
      icon: "🔗",
      onClick: copyPublicLink,
      description: "Shareable online attendee registration form",
    },
    {
      id: "open-public-link",
      label: "Open Protected Registration Form",
      icon: "↗️",
      onClick: () => {
        const slug = event?.slug || "summer-retreat-2026";
        const codeParam = event?.requireAccessCode && event?.registrationAccessCode ? `?code=${event.registrationAccessCode.trim().toUpperCase()}` : "";
        window.open(`/r/${slug}${codeParam}`, "_blank");
      },
      description: "Preview the attendee self-registration portal",
    },
    {
      id: "div-public",
      divider: true,
      label: "",
    },
    {
      id: "bulk-print",
      label: "Bulk Print QR Passes",
      icon: "🖨️",
      onClick: () => setShowBulkPrintModal(true),
      description: "Print QR badges for all confirmed families",
    },
    {
      id: "bulk-csv",
      label: "Bulk Register (CSV)",
      icon: "📁",
      onClick: () => setShowBulkModal(true),
      description: "Upload and import registrations from CSV",
    },
    {
      id: "download-template",
      label: "Download CSV Template",
      icon: "📥",
      onClick: handleDownloadTemplate,
      description: "Sample headers and formatting guide",
    },
    {
      id: "div-1",
      divider: true,
      label: "",
    },
    {
      id: "reminders",
      label: "Send Incomplete Reminders",
      icon: "⏰",
      onClick: () => handleRemind("Incomplete registrations"),
      description: "Notify families with missing details or waivers",
    },
  ];

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      <div className="top">
        <div>
          <h1>Registration</h1>
          <div className="sub">Guided intake process with completeness tracking, waivers, waitlists, and follow-up actions.</div>
        </div>
        <div className="actions">
          {event?.registrationMode === "PUBLIC_SELF" && (
            <button
              type="button"
              onClick={copyPublicLink}
              className="btn"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
              title="Copy public registration URL"
            >
              🔗 Share Public Link
            </button>
          )}
          <Link href="/registration/new" className="btn primary">+ New Registration</Link>
          <ActionDropdown label="Actions" items={registrationActions} />
        </div>
      </div>

      {/* Public Registration Status Banner */}
      {event?.registrationMode === "PUBLIC_SELF" ? (
        <div style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "10px",
          padding: "12px 16px",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>🌐</span>
            <div>
              <strong style={{ fontSize: "13px", color: "#166534", display: "block" }}>
                Protected Self-Registration is Active {event?.requireAccessCode && event?.registrationAccessCode ? `(Passcode: ${event.registrationAccessCode})` : ""}
              </strong>
              <span style={{ fontSize: "12px", color: "#15803d" }}>
                Share protected link: <strong>/r/{event?.slug || "summer-retreat-2026"}{event?.requireAccessCode && event?.registrationAccessCode ? `?code=${event.registrationAccessCode}` : ""}</strong>
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={copyPublicLink}
              className="btn"
              style={{ fontSize: "12px", padding: "6px 12px", background: "#ffffff", borderColor: "#86efac", color: "#166534" }}
            >
              📋 Copy Protected Link
            </button>
            <a
              href={`/r/${event?.slug || "summer-retreat-2026"}${event?.requireAccessCode && event?.registrationAccessCode ? `?code=${event.registrationAccessCode}` : ""}`}
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{ fontSize: "12px", padding: "6px 12px", background: "#166534", color: "#ffffff", borderColor: "#166534", textDecoration: "none" }}
            >
              Open Form ↗
            </a>
          </div>
        </div>
      ) : (
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 16px",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          fontSize: "12px",
          color: "#64748b"
        }}>
          <div>
            🔒 <strong>Public Self-Registration is Disabled.</strong> Only organizers can add registrations. You can enable public self-registration in <Link href="/settings" style={{ color: "#4f46e5", fontWeight: 600 }}>Settings</Link>.
          </div>
        </div>
      )}

      <div className="grid cards4">
        <div className="card metric"><div className="label">Total</div><div className="value">{data.length}</div></div>
        <div className="card metric"><div className="label">Confirmed</div><div className="value">{data.filter(x => x.status === "Confirmed").length}</div></div>
        <div className="card metric"><div className="label">Needs Attention</div><div className="value">{attentionReg}</div></div>
        <div className="card metric"><div className="label">Waitlist</div><div className="value">{data.filter(x => x.status === "Waitlist").length}</div></div>
      </div>

      <div className="card toolbar section">
        <input className="input wide" value={query} placeholder="Search family, email, source..." onChange={(e) => setQuery(e.target.value)} />
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Pending">Pending</option>
          <option value="Waitlist">Waitlist</option>
        </select>
        <Link href="/communications" className="btn">Message registrants</Link>
      </div>

      <div className="card panel">
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Family / Group</th><th>Submitted</th><th>Source</th><th>Status</th><th>Complete</th><th>Balance</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(r => (
                <tr key={r.id}>
                  <td><b>{r.family?.name || ""}</b></td>
                  <td>{r.submitted}</td>
                  <td>{r.source}</td>
                  <td><span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div className="progress" style={{ width: "60px" }}>
                        <i style={{ width: `${r.completeness}%` }}></i>
                      </div>
                      {r.completeness}%
                    </div>
                  </td>
                  <td style={{ color: r.balance > 0 ? "var(--red)" : "var(--green)" }}>
                    ${r.balance.toLocaleString()}
                  </td>
                  <td className="actions-cell">
                    {r.family && r.status === "Confirmed" && (
                      <button className="btn tiny" onClick={() => setQrFamilyModal(r.family)} title="View & Print QR Pass">🎫 Pass</button>
                    )}
                    {r.status !== "Confirmed" && (
                      <button className="btn tiny primary" onClick={() => handleApprove(r.id)}>Approve</button>
                    )}
                    {(r.completeness < 100 || !r.waiver) && (
                      <button className="btn tiny" onClick={() => handleRemind(r.family?.name)}>Remind</button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">No registrations match your search filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Registration Modal */}
      {showBulkModal && (
        <div className="modalbg show" onClick={() => setShowBulkModal(false)}>
          <div className="modal" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
            <h2>Bulk Register Families (CSV Upload)</h2>
            <p>Upload a CSV file formatted with standard RetreatFlow headers to import multiple family registrations at once.</p>
            
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <button className="btn" onClick={handleDownloadTemplate}>📥 Download CSV Template</button>
            </div>

            <div style={{ padding: "16px", border: "2px dashed var(--border)", borderRadius: "8px", textAlign: "center", marginBottom: "15px" }}>
              <label style={{ cursor: "pointer", display: "block" }}>
                <span className="btn primary" style={{ display: "inline-block" }}>Choose CSV File</span>
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
              </label>
              {bulkFileName && <div style={{ marginTop: "8px", fontWeight: "bold" }}>Selected File: {bulkFileName}</div>}
            </div>

            {parsedBulkData.length > 0 && (
              <div style={{ maxHeight: "250px", overflowY: "auto", marginBottom: "15px" }}>
                <div style={{ marginBottom: "6px", fontWeight: "bold" }}>Preview Parsed Families ({parsedBulkData.length}):</div>
                <table className="table" style={{ fontSize: "12px" }}>
                  <thead>
                    <tr><th>Name</th><th>Leader</th><th>Email</th><th>Adults</th><th>Paying C</th><th>Free C</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {parsedBulkData.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.leader}</td>
                        <td>{r.email}</td>
                        <td>{r.adults}</td>
                        <td>{r.children}</td>
                        <td>{r.nonPayingChildren}</td>
                        <td><span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => { setShowBulkModal(false); setParsedBulkData([]); setBulkFileName(""); }}>Cancel</button>
              <button type="button" className="btn primary" disabled={parsedBulkData.length === 0} onClick={handleSaveBulk}>
                Import {parsedBulkData.length} Families
              </button>
            </div>
          </div>
        </div>
      )}
      {qrFamilyModal && (
        <QRCodeModal family={qrFamilyModal} onClose={() => setQrFamilyModal(null)} />
      )}
      {showBulkPrintModal && (
        <BulkQRPrintModal families={data.map(r => r.family ? { ...r.family, status: r.status } : null).filter(Boolean)} onClose={() => setShowBulkPrintModal(false)} />
      )}
    </>
  );
}
