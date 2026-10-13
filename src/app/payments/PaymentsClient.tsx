"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PaymentsClient({ payments, families, event }: { payments: any[], families: any[], event?: any }) {
  const router = useRouter();
  const [data, setData] = useState(payments);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [payForm, setPayForm] = useState({ familyId: families[0]?.id || "", amount: 120, method: "Card" });

  const pricePerAdult = event?.pricePerAdult ?? 120;
  const pricePerChild = event?.pricePerChild ?? 60;
  const expected = families.reduce((s, f) => s + (f.adults * pricePerAdult) + (f.children * pricePerChild), 0);
  
  const getPaymentStatus = (p: any) => {
    if (p.status === "Paid") return "Paid";
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
    return p.status || "Pending";
  };

  const isDeposit = (p: any) => {
    if (event?.hasDownpayment && event?.downpaymentAmount && p.amount === event.downpaymentAmount) return true;
    if (event?.downpaymentDueDate && p.due === event.downpaymentDueDate) return true;
    return false;
  };

  const paid = data.filter(p => p.status === "Paid").reduce((s, p) => s + p.amount, 0);
  const open = Math.max(0, expected - paid);
  const overdueCount = data.filter(p => getPaymentStatus(p) === "Overdue").length;
  const paidProgress = expected ? Math.min(100, (paid / expected) * 100) : 0;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const filteredData = data.filter((p) => {
    const status = getPaymentStatus(p);
    const depositMatch = isDeposit(p);
    const familyName = p.family?.name || "";
    const familyLeader = p.family?.leader || "";
    const familyEmail = p.family?.email || "";
    const hay = `${familyName} ${familyLeader} ${familyEmail} ${p.method} ${status} ${depositMatch ? "deposit downpayment" : ""}`.toLowerCase();
    const matchesQuery = !query || hay.includes(query.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === "Deposit") {
      matchesStatus = depositMatch;
    } else if (statusFilter !== "all") {
      matchesStatus = status === statusFilter;
    }
    
    return matchesQuery && matchesStatus;
  });

  const handleMarkPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-paid" }),
      });
      if (res.ok) {
        setData(prev => prev.map(p => p.id === id ? { ...p, status: "Paid" } : p));
        showToast("Payment marked as paid and balance reduced.");
        router.refresh();
      } else {
        showToast("Failed to update payment.");
      }
    } catch {
      showToast("Error updating payment.");
    }
  };

  const [reminding, setReminding] = useState(false);

  const handleRemind = async (familyName: string) => {
    setReminding(true);
    showToast(`Sending balance reminder email to ${familyName}...`);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: familyName,
          subject: `Retreat Balance Due Reminder: ${familyName}`,
          body: "Please review and settle your remaining retreat registration balance before the upcoming deadline.",
          sendEmail: true,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        const count = result.delivery?.sentCount ?? 1;
        showToast(`✅ Balance reminder delivered to ${count} family email(s)!`);
      } else {
        showToast(result.error || "Error sending balance reminder.");
      }
    } catch {
      showToast("Error connecting to notification service.");
    } finally {
      setReminding(false);
    }
  };

  const handleRecordPayment = async () => {
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payForm),
      });
      if (res.ok) {
        const newPayment = await res.json();
        const familyObj = families.find(f => f.id === payForm.familyId);
        setData(prev => [{ ...newPayment, family: familyObj }, ...prev]);
        setShowModal(false);
        showToast("Payment recorded and balance reduced.");
        router.refresh();
      } else {
        showToast("Failed to record payment.");
      }
    } catch {
      showToast("Error recording payment.");
    }
  };

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      {showModal && (
        <div className="modalbg show" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2>Record Payment</h2>
            <div className="form">
              <label>Family / Group
                <select value={payForm.familyId} onChange={e => setPayForm(p => ({...p, familyId: e.target.value}))}>
                  {families.map(f => {
                    const famPaid = data.filter(p => p.familyId === f.id && p.status === "Paid").reduce((s, p) => s + p.amount, 0);
                    const famTotal = (f.adults * pricePerAdult) + (f.children * pricePerChild);
                    const famDue = Math.max(0, famTotal - famPaid);
                    return (
                      <option key={f.id} value={f.id}>
                        {f.name} (Remaining Due: ${famDue})
                      </option>
                    );
                  })}
                </select>
              </label>
              <div className="formgrid">
                <label>Amount ($)
                  <input type="number" min="1" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: Number(e.target.value)}))} />
                </label>
                <label>Method
                  <select value={payForm.method} onChange={e => setPayForm(p => ({...p, method: e.target.value}))}>
                    <option>Card</option><option>ACH</option><option>Check</option><option>Cash</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleRecordPayment}>Save Payment</button>
            </div>
          </div>
        </div>
      )}

      <div className="top">
        <div>
          <h1>Payments</h1>
          <div className="sub">Clear balances, deposits, due dates, payment tracking, and follow-up.</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShowModal(true)}>+ Record Payment</button>
          <button className="btn" disabled={reminding} onClick={() => handleRemind("Families with balances")}>
            {reminding ? "Sending Reminders..." : "Send Balance Reminders"}
          </button>
        </div>
      </div>

      <div className="grid cards4">
        <div className="card metric"><div className="label">Expected</div><div className="value">${expected.toLocaleString()}</div></div>
        <div className="card metric"><div className="label">Collected</div><div className="value green">${paid.toLocaleString()}</div></div>
        <div className="card metric"><div className="label">Open Balance Due</div><div className="value orange">${open.toLocaleString()}</div></div>
        <div className="card metric"><div className="label">Overdue</div><div className="value red">{overdueCount}</div></div>
      </div>

      <div className="card toolbar section">
        <input 
          className="input wide" 
          value={query} 
          placeholder="Search family/group, leader, email, method, status..." 
          onChange={(e) => setQuery(e.target.value)} 
        />
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All payment statuses & types</option>
          <option value="Deposit">Deposit / Downpayment</option>
          <option value="Paid">Paid</option>
          <option value="Partial">Partial</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>

      <div className="section grid cards2">
        <div className="card panel">
          <div className="section-title">Collection Progress</div>
          <div className="barlabel"><span>${paid.toLocaleString()} collected of ${expected.toLocaleString()}</span><b>{Math.round(paidProgress)}%</b></div>
          <div className="progress"><i style={{ width: `${paidProgress}%` }}></i></div>
          <div className="small" style={{ marginTop: "8px" }}>As payments are collected, remaining open balance due is automatically reduced.</div>
        </div>
        <div className="card panel">
          <div className="section-title">Payment Follow-up</div>
          {data.filter(p => p.status !== "Paid").length > 0 ? data.filter(p => p.status !== "Paid").map(p => {
            const status = getPaymentStatus(p);
            return (
              <div key={p.id} className="listitem">
                <span>
                  <b>{p.family?.name || "Family"}</b> {isDeposit(p) && <span className="pill warning" style={{ fontSize: "11px" }}>Deposit</span>}<br/>
                  <span className="small">${p.amount.toLocaleString()} · due {p.due}</span>
                </span>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span className={`pill ${status.toLowerCase()}`}>{status}</span>
                  <button className="btn tiny" onClick={() => handleRemind(p.family?.name || "Family")}>Remind</button>
                </div>
              </div>
            );
          }) : <div className="empty">All payments collected! 🎉</div>}
        </div>
      </div>

      <div className="card panel section">
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr><th>Family / Group</th><th>Type</th><th>Amount</th><th>Status</th><th>Due Date</th><th>Method</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredData.map(p => {
                const status = getPaymentStatus(p);
                const deposit = isDeposit(p);
                return (
                  <tr key={p.id}>
                    <td><b>{p.family?.name || "Family"}</b></td>
                    <td>{deposit ? <span className="pill info">Deposit</span> : <span className="small">Balance</span>}</td>
                    <td>${p.amount.toLocaleString()}</td>
                    <td><span className={`pill ${status.toLowerCase()}`}>{status}</span></td>
                    <td>{p.due}</td>
                    <td>{p.method}</td>
                    <td className="actions-cell">
                      {p.status !== "Paid" && <button className="btn tiny primary" onClick={() => handleMarkPaid(p.id)}>Mark Paid</button>}
                      {p.status === "Paid" && <span className="pill paid">Paid ✓</span>}
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">No payments match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
