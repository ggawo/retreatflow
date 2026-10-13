"use client";

import { useState } from "react";

interface ReportsClientProps {
  families: any[];
  payments: any[];
  volunteers: any[];
  attendance: any[];
  rooms: any[];
  notifications: any[];
  event?: any;
}

export default function ReportsClient({ 
  families, 
  payments, 
  volunteers, 
  attendance, 
  rooms, 
  notifications,
  event 
}: ReportsClientProps) {
  const [report, setReport] = useState("Executive");
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const reportTexts: Record<string, string> = {
    Executive: "Leadership overview: enrollment, finances, lodging utilization, and staff readiness.",
    Registration: "Registration status, completion rate, waiver verification, and balances due.",
    Finance: "Comprehensive financial ledger: paid, partial, and overdue breakdowns with payment methods.",
    Operations: "Volunteer staff coverage, room capacity utilization, and attendance tracking."
  };

  const showToast = (msg: string) => { 
    setToast(msg); 
    setTimeout(() => setToast(null), 2800); 
  };

  // Helper to determine exact payment status
  const getPaymentStatus = (p: any): "Paid" | "Partial" | "Overdue" | "Pending" => {
    if (p.status === "Paid") return "Paid";
    if (p.status === "Partial") return "Partial";
    if (p.status === "Overdue") return "Overdue";
    if (p.due) {
      const dueDate = new Date(p.due);
      if (!isNaN(dueDate.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dueDate < today) {
          return "Overdue";
        }
      }
    }
    return (p.status as any) || "Pending";
  };

  // Calculations
  const totalParticipants = families.reduce((s, f) => s + f.adults + f.children + (f.nonPayingChildren || 0), 0);
  
  // Categorized payments
  const paidPayments = payments.filter(p => getPaymentStatus(p) === "Paid");
  const partialPayments = payments.filter(p => getPaymentStatus(p) === "Partial");
  const overduePayments = payments.filter(p => getPaymentStatus(p) === "Overdue");
  const pendingPayments = payments.filter(p => getPaymentStatus(p) === "Pending");

  const totalPaidAmount = paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPartialAmount = partialPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalOverdueAmount = overduePayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalInvoiced = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Registration metrics
  const confirmedFamilies = families.filter(f => (f.registration?.status || f.status) === "Confirmed");
  const pendingFamilies = families.filter(f => (f.registration?.status || f.status) === "Pending");
  const totalOutstandingBalance = families.reduce((s, f) => s + Number(f.registration?.balance || 0), 0);
  const zeroBalanceFamilies = families.filter(f => Number(f.registration?.balance || 0) <= 0);

  // Operations metrics
  const occ = rooms.reduce((s, r) => s + (r.families ? r.families.reduce((fs: number, f: any) => fs + f.adults + f.children + (f.nonPayingChildren || 0), 0) : 0), 0);
  const cap = rooms.reduce((s, r) => s + r.capacity, 0);
  const volConfirmed = volunteers.filter(v => v.status === "Confirmed").length;
  const volCoverage = volunteers.length ? Math.round((volConfirmed / volunteers.length) * 100) : 0;
  const util = cap ? Math.round((occ / cap) * 100) : 0;

  // Filtered payments for Finance table
  const filteredPayments = payments.filter(p => {
    const status = getPaymentStatus(p);
    const familyName = (p.family?.name || "").toLowerCase();
    const familyLeader = (p.family?.leader || "").toLowerCase();
    const method = (p.method || "").toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = !q || familyName.includes(q) || familyLeader.includes(q) || method.includes(q);
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtered families for Registration table
  const filteredFamilies = families.filter(f => {
    const status = f.registration?.status || f.status || "Pending";
    const balance = Number(f.registration?.balance || 0);
    const name = (f.name || "").toLowerCase();
    const leader = (f.leader || "").toLowerCase();
    const email = (f.email || "").toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = !q || name.includes(q) || leader.includes(q) || email.includes(q);
    
    let matchesStatus = true;
    if (statusFilter === "Confirmed") matchesStatus = status === "Confirmed";
    else if (statusFilter === "Pending") matchesStatus = status === "Pending";
    else if (statusFilter === "HasBalance") matchesStatus = balance > 0;
    else if (statusFilter === "ZeroBalance") matchesStatus = balance <= 0;

    return matchesSearch && matchesStatus;
  });

  // Filtered volunteers for Operations table
  const filteredVolunteers = volunteers.filter(v => {
    const name = (v.name || "").toLowerCase();
    const role = (v.role || "").toLowerCase();
    const status = v.status || "";
    const q = searchQuery.toLowerCase();

    const matchesSearch = !q || name.includes(q) || role.includes(q);
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // CSV Export
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];

    if (report === "Registration") {
      headers = ["Family", "Leader", "Status", "Completeness", "Waiver", "Balance Due"];
      rows = filteredFamilies.map(f => [
        `"${f.name}"`,
        `"${f.leader || ""}"`,
        f.registration?.status || f.status || "Pending",
        `${f.registration?.completeness || 0}%`,
        f.registration?.waiver ? "Complete" : "Missing",
        (f.registration?.balance || 0).toFixed(2)
      ]);
    } else if (report === "Finance") {
      headers = ["Family", "Status", "Amount ($)", "Method", "Due Date"];
      rows = filteredPayments.map(p => [
        `"${p.family?.name || ""}"`,
        getPaymentStatus(p),
        p.amount.toFixed(2),
        p.method || "None",
        `"${p.due || ""}"`
      ]);
    } else if (report === "Operations") {
      headers = ["Volunteer", "Role", "Status", "Shift"];
      rows = filteredVolunteers.map(v => [
        `"${v.name}"`,
        `"${v.role}"`,
        v.status || "Pending",
        `"${v.shift || ""}"`
      ]);
    } else {
      headers = ["Metric", "Value"];
      rows = [
        ["Total Participants", totalParticipants],
        ["Total Invoiced ($)", totalInvoiced.toFixed(2)],
        ["Total Collected ($)", totalPaidAmount.toFixed(2)],
        ["Partial Amount ($)", totalPartialAmount.toFixed(2)],
        ["Overdue Amount ($)", totalOverdueAmount.toFixed(2)],
        ["Room Utilization (%)", util],
        ["Volunteer Coverage (%)", volCoverage],
      ];
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `retreatflow_${report.toLowerCase()}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${report} CSV report exported!`);
  };

  // JSON Export
  const handleExportJSON = () => {
    let dataToExport: any = {};
    if (report === "Registration") dataToExport = filteredFamilies;
    else if (report === "Finance") dataToExport = filteredPayments;
    else if (report === "Operations") dataToExport = filteredVolunteers;
    else dataToExport = { 
      totalParticipants, 
      totalInvoiced, 
      totalPaidAmount, 
      totalPartialAmount, 
      totalOverdueAmount, 
      util, 
      volCoverage, 
      notifications 
    };

    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonStr);
    link.setAttribute("download", `retreatflow_${report.toLowerCase()}_report.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${report} JSON report exported!`);
  };

  // Color rendering helpers
  const renderPaymentStatusBadge = (status: "Paid" | "Partial" | "Overdue" | "Pending") => {
    if (status === "Paid") {
      return (
        <span className="report-badge paid">
          <span className="report-badge-dot"></span>
          Paid ✓
        </span>
      );
    }
    if (status === "Partial") {
      return (
        <span className="report-badge partial">
          <span className="report-badge-dot"></span>
          Partial ◐
        </span>
      );
    }
    if (status === "Overdue") {
      return (
        <span className="report-badge overdue">
          <span className="report-badge-dot"></span>
          Overdue ⚠️
        </span>
      );
    }
    return (
      <span className="report-badge pending">
        <span className="report-badge-dot"></span>
        Pending ⏳
      </span>
    );
  };

  const renderPaymentAmount = (amount: number, status: "Paid" | "Partial" | "Overdue" | "Pending") => {
    const formatted = `$${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (status === "Paid") {
      return <span className="report-amount-tag paid">✓ {formatted}</span>;
    }
    if (status === "Partial") {
      return <span className="report-amount-tag partial">◐ {formatted}</span>;
    }
    if (status === "Overdue") {
      return <span className="report-amount-tag overdue">⚠️ {formatted}</span>;
    }
    return <span className="report-amount-tag pending">⏳ {formatted}</span>;
  };

  const renderRegistrationStatusBadge = (status: string) => {
    const s = (status || "Pending").toLowerCase();
    if (s === "confirmed") {
      return (
        <span className="report-badge confirmed">
          <span className="report-badge-dot"></span>
          Confirmed ✓
        </span>
      );
    }
    if (s === "waitlist") {
      return (
        <span className="report-badge waitlist">
          <span className="report-badge-dot"></span>
          Waitlist 📋
        </span>
      );
    }
    return (
      <span className="report-badge pending">
        <span className="report-badge-dot"></span>
        Pending ⏳
      </span>
    );
  };

  const renderRegistrationBalance = (balance: number) => {
    const num = Number(balance || 0);
    if (num <= 0) {
      return (
        <span className="report-amount-tag zero-balance">
          ✓ $0.00 (Paid in Full)
        </span>
      );
    }
    return (
      <span className="report-amount-tag balance-due">
        ● ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Due
      </span>
    );
  };

  const renderWaiverBadge = (waiver: boolean) => {
    if (waiver) {
      return (
        <span className="report-badge complete">
          <span className="report-badge-dot"></span>
          Complete ✓
        </span>
      );
    }
    return (
      <span className="report-badge missing">
        <span className="report-badge-dot"></span>
        Missing ✕
      </span>
    );
  };

  const renderVolunteerStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "confirmed") {
      return (
        <span className="report-badge confirmed">
          <span className="report-badge-dot"></span>
          Confirmed ✓
        </span>
      );
    }
    if (s === "declined") {
      return (
        <span className="report-badge declined">
          <span className="report-badge-dot"></span>
          Declined ✕
        </span>
      );
    }
    return (
      <span className="report-badge partial">
        <span className="report-badge-dot"></span>
        Pending ⏳
      </span>
    );
  };

  const renderTable = (headers: string[], rows: any[]) => (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            {headers.map(h => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell: any, j: number) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                No records match your filter criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderExecutive = () => {
    const regComp = families.length ? Math.round(families.reduce((s, f) => s + (f.registration?.completeness || 0), 0) / families.length) : 0;
    const payComp = totalInvoiced ? Math.round((totalPaidAmount / totalInvoiced) * 100) : 0;
    const attComp = attendance.length ? Math.round((attendance.filter(a => a.checkin !== "Pending").length / attendance.length) * 100) : 0;

    return (
      <div className="grid cards2">
        <div>
          <div className="section-title">Key Exceptions & Critical Follow-ups</div>
          {notifications.length > 0 ? notifications.map(n => (
            <div key={n.id} className="alert">
              <strong>{n.title}</strong>
              <span>{n.detail}</span>
            </div>
          )) : (
            <div className="alert" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
              <strong>All systems on schedule!</strong>
              <span>No critical operational blockers or payment escalations detected.</span>
            </div>
          )}

          {overduePayments.length > 0 && (
            <div className="alert" style={{ background: "#fef2f2", borderColor: "#fecaca", marginTop: "10px" }}>
              <strong style={{ color: "#991b1b" }}>⚠️ {overduePayments.length} Overdue Payments Pending</strong>
              <span style={{ color: "#7f1d1d" }}>
                Total overdue balance: <strong>${totalOverdueAmount.toLocaleString()}</strong> across {overduePayments.length} family accounts. Send reminders via Payments view.
              </span>
            </div>
          )}
        </div>

        <div>
          <div className="section-title">Operational Readiness Health</div>
          {[
            { label: "Registration completion", val: regComp, colorClass: regComp >= 80 ? "metric-green" : "metric-amber" },
            { label: "Payment collection", val: payComp, colorClass: payComp >= 80 ? "metric-green" : payComp >= 50 ? "metric-amber" : "metric-red" },
            { label: "Volunteer coverage", val: volCoverage, colorClass: volCoverage >= 80 ? "metric-green" : "metric-amber" },
            { label: "Attendance captured", val: attComp, colorClass: attComp > 0 ? "metric-green" : "metric-blue" }
          ].map(({ label, val, colorClass }) => (
            <div key={label} style={{ marginBottom: "14px" }}>
              <div className="barlabel">
                <span style={{ fontWeight: 600 }}>{label}</span>
                <b className={colorClass}>{val}%</b>
              </div>
              <div className="progress">
                <i style={{ 
                  width: `${val}%`, 
                  background: val >= 80 ? "#10b981" : val >= 50 ? "#f59e0b" : "#ef4444" 
                }}></i>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      <div className="top">
        <div>
          <h1>Reports & Analytics</h1>
          <div className="sub">Interactive, color-coded retreat operations reports with real-time status and financial tracking.</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={handleExportCSV}>Export CSV</button>
          <button className="btn" onClick={handleExportJSON}>Export JSON</button>
        </div>
      </div>

      {/* Report Segment Tabs */}
      <div className="segment section">
        {Object.keys(reportTexts).map(x => (
          <button 
            key={x} 
            className={report === x ? "active" : ""} 
            onClick={() => {
              setReport(x);
              setStatusFilter("all");
              setSearchQuery("");
            }}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="card panel section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div>
            <div className="section-title">{report} Report</div>
            <div className="small">{reportTexts[report]}</div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
            Retreat: <strong>{event?.name || "Family Summer Retreat"}</strong>
          </div>
        </div>
        
        {/* Dynamic Color-Coded Metrics Cards */}
        <div className="grid cards4 section">
          {report === "Finance" ? (
            <>
              <div className="card metric">
                <div className="label">Total Invoiced</div>
                <div className="value">${totalInvoiced.toLocaleString()}</div>
                <div className="metric-sublabel">{payments.length} total payments</div>
              </div>
              <div className="card metric">
                <div className="label">Amount Paid</div>
                <div className="value metric-green">+${totalPaidAmount.toLocaleString()}</div>
                <div className="metric-sublabel">{paidPayments.length} paid transactions</div>
              </div>
              <div className="card metric">
                <div className="label">Partial Amount</div>
                <div className="value metric-amber">◐ ${totalPartialAmount.toLocaleString()}</div>
                <div className="metric-sublabel">{partialPayments.length} partial payments</div>
              </div>
              <div className="card metric">
                <div className="label">Overdue Amount</div>
                <div className="value metric-red">⚠️ ${totalOverdueAmount.toLocaleString()}</div>
                <div className="metric-sublabel">{overduePayments.length} overdue payments</div>
              </div>
            </>
          ) : report === "Registration" ? (
            <>
              <div className="card metric">
                <div className="label">Total Groups</div>
                <div className="value">{families.length}</div>
                <div className="metric-sublabel">{totalParticipants} attendees registered</div>
              </div>
              <div className="card metric">
                <div className="label">Confirmed</div>
                <div className="value metric-green">{confirmedFamilies.length}</div>
                <div className="metric-sublabel">
                  {families.length ? Math.round((confirmedFamilies.length / families.length) * 100) : 0}% confirmed
                </div>
              </div>
              <div className="card metric">
                <div className="label">Pending Verification</div>
                <div className="value metric-amber">{pendingFamilies.length}</div>
                <div className="metric-sublabel">Awaiting payment & approval</div>
              </div>
              <div className="card metric">
                <div className="label">Outstanding Balance</div>
                <div className="value metric-red">${totalOutstandingBalance.toLocaleString()}</div>
                <div className="metric-sublabel">{families.length - zeroBalanceFamilies.length} groups with balance</div>
              </div>
            </>
          ) : report === "Operations" ? (
            <>
              <div className="card metric">
                <div className="label">Total Volunteers</div>
                <div className="value">{volunteers.length}</div>
                <div className="metric-sublabel">Assigned to ministry shifts</div>
              </div>
              <div className="card metric">
                <div className="label">Confirmed Staff</div>
                <div className="value metric-green">{volCoverage}%</div>
                <div className="metric-sublabel">{volConfirmed} of {volunteers.length} confirmed</div>
              </div>
              <div className="card metric">
                <div className="label">Pending Staff</div>
                <div className="value metric-amber">{volunteers.length - volConfirmed}</div>
                <div className="metric-sublabel">Awaiting shift confirmation</div>
              </div>
              <div className="card metric">
                <div className="label">Room Utilization</div>
                <div className="value metric-blue">{util}%</div>
                <div className="metric-sublabel">{occ} of {cap} beds assigned</div>
              </div>
            </>
          ) : (
            <>
              <div className="card metric">
                <div className="label">Participants</div>
                <div className="value">{totalParticipants}</div>
                <div className="metric-sublabel">{families.length} registered groups</div>
              </div>
              <div className="card metric">
                <div className="label">Revenue Collected</div>
                <div className="value metric-green">${totalPaidAmount.toLocaleString()}</div>
                <div className="metric-sublabel">
                  {totalInvoiced ? Math.round((totalPaidAmount / totalInvoiced) * 100) : 0}% of expected
                </div>
              </div>
              <div className="card metric">
                <div className="label">Open Balances Due</div>
                <div className="value metric-amber">${totalOutstandingBalance.toLocaleString()}</div>
                <div className="metric-sublabel">Outstanding retreat fees</div>
              </div>
              <div className="card metric">
                <div className="label">Overdue Accounts</div>
                <div className="value metric-red">{overduePayments.length}</div>
                <div className="metric-sublabel">${totalOverdueAmount.toLocaleString()} total overdue</div>
              </div>
            </>
          )}
        </div>

        {/* Filter Toolbar for tabular reports */}
        {report !== "Executive" && (
          <div className="report-toolbar section">
            <input 
              type="text" 
              className="input report-search-input" 
              placeholder={`Search ${report.toLowerCase()} report by group, leader, method, or role...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {report === "Finance" && (
              <select 
                className="select" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ minWidth: "160px" }}
              >
                <option value="all">All Payment Statuses</option>
                <option value="Paid">✓ Paid Only</option>
                <option value="Partial">◐ Partial Only</option>
                <option value="Overdue">⚠️ Overdue Only</option>
                <option value="Pending">⏳ Pending Only</option>
              </select>
            )}

            {report === "Registration" && (
              <select 
                className="select" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ minWidth: "160px" }}
              >
                <option value="all">All Registrations</option>
                <option value="Confirmed">✓ Confirmed Only</option>
                <option value="Pending">⏳ Pending Only</option>
                <option value="HasBalance">● Has Balance Due</option>
                <option value="ZeroBalance">✓ Zero Balance (Paid Off)</option>
              </select>
            )}

            {report === "Operations" && (
              <select 
                className="select" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ minWidth: "160px" }}
              >
                <option value="all">All Volunteer Statuses</option>
                <option value="Confirmed">✓ Confirmed Only</option>
                <option value="Pending">⏳ Pending Only</option>
                <option value="Declined">✕ Declined Only</option>
              </select>
            )}

            {(searchQuery || statusFilter !== "all") && (
              <button 
                className="btn tiny" 
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                style={{ padding: "8px 12px" }}
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        <div className="section">
          {report === "Executive" && renderExecutive()}
          
          {report === "Registration" && renderTable(
            ["Family / Group", "Registration Status", "Completeness", "Safety Waiver", "Retreat Balance"],
            filteredFamilies.map(f => [
              <div>
                <strong>{f.name}</strong>
                <div className="small">{f.leader || "Lead Contact"} · {f.adults}A, {f.children}C</div>
              </div>,
              renderRegistrationStatusBadge(f.registration?.status || f.status),
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "60px" }} className="progress">
                  <i style={{ 
                    width: `${f.registration?.completeness || 0}%`,
                    background: (f.registration?.completeness || 0) >= 100 ? "#10b981" : "#f59e0b"
                  }}></i>
                </div>
                <span style={{ 
                  fontSize: "12px", 
                  fontWeight: 700, 
                  color: (f.registration?.completeness || 0) >= 100 ? "#047857" : "#b45309" 
                }}>
                  {f.registration?.completeness || 0}%
                </span>
              </div>,
              renderWaiverBadge(Boolean(f.registration?.waiver)),
              renderRegistrationBalance(f.registration?.balance || 0)
            ])
          )}

          {report === "Finance" && renderTable(
            ["Family / Group", "Payment Status", "Amount Due / Paid", "Payment Method", "Due Date"],
            filteredPayments.map(p => {
              const status = getPaymentStatus(p);
              return [
                <div>
                  <strong>{p.family?.name || "Family"}</strong>
                  <div className="small">{p.family?.leader || "Attendee"} {p.family?.email ? `· ${p.family.email}` : ""}</div>
                </div>,
                renderPaymentStatusBadge(status),
                renderPaymentAmount(p.amount, status),
                <span className="report-badge info">
                  <span className="report-badge-dot"></span>
                  {p.method || "Card"}
                </span>,
                <span style={{ 
                  fontSize: "12px", 
                  fontWeight: status === "Overdue" ? 700 : 500,
                  color: status === "Overdue" ? "#dc2626" : "var(--muted)" 
                }}>
                  {p.due || "Check-in"} {status === "Overdue" && "⚠️"}
                </span>
              ];
            })
          )}

          {report === "Operations" && renderTable(
            ["Volunteer / Staff", "Ministry Role", "Status", "Scheduled Shift"],
            filteredVolunteers.map(v => [
              <strong>{v.name}</strong>,
              <span className="report-badge info">
                <span className="report-badge-dot"></span>
                {v.role}
              </span>,
              renderVolunteerStatusBadge(v.status),
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>{v.shift || "All Sessions"}</span>
            ])
          )}
        </div>
      </div>
    </>
  );
}
