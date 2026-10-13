"use client";

import { useState, useEffect, useRef } from "react";

interface MessageItem {
  id: string;
  target: string;
  subject: string;
  body?: string | null;
  sent: string;
  status: string;
  recipientCount?: number;
  recipientsJson?: string | null;
}

interface TemplateItem {
  id: string;
  name: string;
  category?: string;
  subject: string;
  body: string;
  target: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  calloutNote?: string | null;
  isBuiltin?: boolean;
}

interface FamilyItem {
  id: string;
  name: string;
  leader: string;
  email: string;
  status?: string;
}

export default function CommunicationsClient({
  initialData,
  event,
  families = [],
}: {
  initialData: MessageItem[];
  event?: any;
  families?: FamilyItem[];
}) {
  const [messages, setMessages] = useState<MessageItem[]>(initialData);
  const [toast, setToast] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"compose" | "preview">("compose");
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // SMTP connection info
  const [smtpStatus, setSmtpStatus] = useState<{ connected: boolean; host?: string; user?: string } | null>(null);

  // Templates
  const [templates, setTemplates] = useState<{ builtin: TemplateItem[]; custom: TemplateItem[] }>({
    builtin: [],
    custom: [],
  });
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Audience preview state
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // Targeting Mode
  const [targetingMode, setTargetingMode] = useState<"segment" | "family" | "direct">("segment");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [directEmails, setDirectEmails] = useState("");

  // Form State
  const [form, setForm] = useState({
    target: "All registered families",
    subject: "",
    body: "",
    buttonText: "",
    buttonUrl: "",
    calloutNote: "",
    sendEmail: true,
  });

  const [showAdvancedDesign, setShowAdvancedDesign] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [showTestInput, setShowTestInput] = useState(false);

  const bodyInputRef = useRef<HTMLTextAreaElement>(null);

  const segments = [
    "All registered families",
    "Pending payments",
    "Incomplete registrations",
    "Confirmed families",
    "Volunteers",
    "Waitlist",
  ];

  const mergeTags = [
    { tag: "{{name}}", desc: "Attendee's Leader / Name" },
    { tag: "{{family}}", desc: "Family / Group Name" },
    { tag: "{{event}}", desc: "Retreat Title" },
    { tag: "{{dates}}", desc: "Retreat Dates" },
    { tag: "{{location}}", desc: "Venue / Camp Location" },
    { tag: "{{balance}}", desc: "Open Balance Amount ($)" },
  ];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3800);
  };

  // Check SMTP status & load templates on mount
  useEffect(() => {
    fetch("/api/messages?smtpStatus=1")
      .then((res) => res.json())
      .then((data) => setSmtpStatus(data))
      .catch(() => setSmtpStatus({ connected: false }));

    loadTemplates();
  }, []);

  const loadTemplates = () => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.builtin || data.custom) {
          setTemplates(data);
        }
      })
      .catch((err) => console.error("Error loading templates:", err));
  };

  // Fetch audience preview when target changes
  useEffect(() => {
    if (!showModal) return;

    if (targetingMode === "family") {
      setAudienceCount(selectedFamilyId ? 1 : 0);
      return;
    }

    if (targetingMode === "direct") {
      const count = directEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.includes("@")).length;
      setAudienceCount(count);
      return;
    }

    setAudienceLoading(true);
    fetch(`/api/messages?target=${encodeURIComponent(form.target)}`)
      .then((res) => res.json())
      .then((data) => {
        setAudienceCount(data.count ?? 0);
        setAudienceLoading(false);
      })
      .catch(() => {
        setAudienceCount(null);
        setAudienceLoading(false);
      });
  }, [form.target, targetingMode, selectedFamilyId, directEmails, showModal]);

  // Generate live preview when switching to preview tab
  useEffect(() => {
    if (activeTab !== "preview") return;

    setPreviewLoading(true);
    fetch("/api/messages/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: form.subject || "Retreat Announcement",
        body: form.body || "Your message body text goes here...",
        buttonText: form.buttonText,
        buttonUrl: form.buttonUrl,
        calloutNote: form.calloutNote,
        recipientName: targetingMode === "family" && selectedFamilyId
          ? families.find((f) => f.id === selectedFamilyId)?.leader
          : "Sarah Miller",
        familyName: targetingMode === "family" && selectedFamilyId
          ? families.find((f) => f.id === selectedFamilyId)?.name
          : "Miller Family",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setPreviewHtml(data.html || "");
        setPreviewLoading(false);
      })
      .catch(() => setPreviewLoading(false));
  }, [activeTab, form, targetingMode, selectedFamilyId, families]);

  const openCompose = (seg?: string) => {
    const target = seg || "All registered families";
    setTargetingMode("segment");
    setSelectedFamilyId("");
    setDirectEmails("");
    setActiveTab("compose");
    setForm({
      target,
      subject: "",
      body: "",
      buttonText: "",
      buttonUrl: "",
      calloutNote: "",
      sendEmail: true,
    });
    setShowModal(true);
  };

  const applyTemplate = (tpl: TemplateItem) => {
    setForm((p) => ({
      ...p,
      target: tpl.target || p.target,
      subject: tpl.subject,
      body: tpl.body,
      buttonText: tpl.buttonText || "",
      buttonUrl: tpl.buttonUrl || "",
      calloutNote: tpl.calloutNote || "",
    }));
    if (tpl.buttonText || tpl.calloutNote) {
      setShowAdvancedDesign(true);
    }
    showToast(`Loaded template: "${tpl.name}"`);
  };

  const insertMergeTag = (tag: string) => {
    if (!bodyInputRef.current) {
      setForm((p) => ({ ...p, body: p.body + " " + tag }));
      return;
    }

    const textarea = bodyInputRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.body;
    const before = text.substring(0, start);
    const after = text.substring(end);

    setForm((p) => ({ ...p, body: before + tag + after }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const handleSaveAsTemplate = async () => {
    const tplName = saveTemplateName.trim();
    if (!tplName) {
      showToast("Please enter a name for your custom template.");
      return;
    }
    const subjectToUse = form.subject.trim() || tplName;
    const bodyToUse = form.body.trim() || "Greetings {{name}} and {{family}}!\n\nWrite your announcement or instructions here.\n\nBlessings,\nRetreat Planning Committee";

    setSavingTemplate(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tplName,
          subject: subjectToUse,
          body: bodyToUse,
          target: form.target,
          buttonText: form.buttonText,
          buttonUrl: form.buttonUrl,
          calloutNote: form.calloutNote,
        }),
      });

      if (res.ok) {
        showToast(`⭐ Custom template "${tplName}" saved successfully!`);
        setShowSaveTemplateModal(false);
        setSaveTemplateName("");
        loadTemplates();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save template.");
      }
    } catch {
      showToast("Error saving custom template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete custom template "${templateName}"?`)) return;

    try {
      const res = await fetch(`/api/templates?id=${templateId}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Removed custom template "${templateName}".`);
        loadTemplates();
      }
    } catch {
      showToast("Error deleting template.");
    }
  };

  const handleSendTest = async () => {
    const emailToUse = testEmailAddress.trim();
    if (!emailToUse || !emailToUse.includes("@")) {
      showToast("Please enter a valid test email address.");
      return;
    }

    setTestSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isTest: true,
          testEmail: emailToUse,
          subject: form.subject || "RetreatFlow Test Email Notification",
          body: form.body || "This is a test notification confirming that email delivery is active.",
          buttonText: form.buttonText,
          buttonUrl: form.buttonUrl,
          calloutNote: form.calloutNote,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`✅ Test email delivered to ${emailToUse}!`);
      } else {
        showToast(data.error || "Failed to send test email.");
      }
    } catch {
      showToast("Error sending test email.");
    } finally {
      setTestSending(false);
    }
  };

  const handleSend = async () => {
    if (!form.subject.trim()) {
      showToast("Please enter a subject line.");
      return;
    }
    if (!form.body.trim()) {
      showToast("Please enter a message body.");
      return;
    }

    // Determine target based on mode
    let resolvedTarget = form.target;
    let directEmailsParam: string | null = null;

    if (targetingMode === "family") {
      const fam = families.find((f) => f.id === selectedFamilyId);
      if (!fam) {
        showToast("Please select a target family.");
        return;
      }
      resolvedTarget = fam.name;
    } else if (targetingMode === "direct") {
      if (!directEmails.trim()) {
        showToast("Please enter at least one recipient email.");
        return;
      }
      resolvedTarget = "Direct Email List";
      directEmailsParam = directEmails.trim();
    }

    setLoading(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: resolvedTarget,
          subject: form.subject,
          body: form.body,
          buttonText: form.buttonText || null,
          buttonUrl: form.buttonUrl || null,
          calloutNote: form.calloutNote || null,
          directEmails: directEmailsParam,
          sendEmail: form.sendEmail,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const createdMsg = data.message;
        setMessages((prev) => [createdMsg, ...prev]);
        setShowModal(false);
        const count = data.delivery?.sentCount ?? createdMsg.recipientCount ?? 0;
        showToast(`✉️ Message sent and delivered to ${count} recipient(s)!`);
        setForm({
          target: "All registered families",
          subject: "",
          body: "",
          buttonText: "",
          buttonUrl: "",
          calloutNote: "",
          sendEmail: true,
        });
      } else {
        showToast(data.error || "Failed to send message.");
      }
    } catch {
      showToast("Network error while sending message.");
    } finally {
      setLoading(false);
    }
  };

  const totalDelivered = messages.reduce((s, m) => s + (m.recipientCount || 1), 0);

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      {/* Save Custom Template Modal */}
      {showSaveTemplateModal && (
        <div className="modalbg show" style={{ zIndex: 1200 }} onClick={() => setShowSaveTemplateModal(false)}>
          <div className="modal" style={{ maxWidth: "460px", zIndex: 1201 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px" }}>Save as Reusable Template</h3>
            <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 16px" }}>
              Give this customized email layout a memorable name to reuse it anytime for this retreat.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveAsTemplate(); }}>
              <div className="form">
                <label>Template Name *
                  <input
                    className="input"
                    value={saveTemplateName}
                    onChange={(e) => setSaveTemplateName(e.target.value)}
                    placeholder="e.g. Youth Night Out Permission Notice"
                    autoFocus
                  />
                </label>
              </div>
              <div className="modal-actions" style={{ marginTop: "16px" }}>
                <button type="button" className="btn" onClick={() => setShowSaveTemplateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={savingTemplate}>
                  {savingTemplate ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compose & Custom Email Builder Modal */}
      {showModal && (
        <div
          className="modalbg show"
          onClick={(e) => e.target === e.currentTarget && !loading && setShowModal(false)}
        >
          <div className="modal" style={{ maxWidth: "780px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2 style={{ margin: 0 }}>Customized Email & Message Builder</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs (Compose vs Live Preview) */}
            <div
              style={{
                display: "flex",
                background: "#f1f5f9",
                borderRadius: "8px",
                padding: "3px",
                marginBottom: "16px",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("compose")}
                style={{
                  flex: 1,
                  padding: "8px 14px",
                  border: 0,
                  borderRadius: "6px",
                  background: activeTab === "compose" ? "#ffffff" : "transparent",
                  color: activeTab === "compose" ? "#0f172a" : "#64748b",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  boxShadow: activeTab === "compose" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                ✍️ Compose & Customize
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                style={{
                  flex: 1,
                  padding: "8px 14px",
                  border: 0,
                  borderRadius: "6px",
                  background: activeTab === "preview" ? "#ffffff" : "transparent",
                  color: activeTab === "preview" ? "#0f172a" : "#64748b",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  boxShadow: activeTab === "preview" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                👁️ Live Email Inbox Preview
              </button>
            </div>

            {activeTab === "compose" ? (
              <div className="form">
                {/* 1. Template Chooser & Actions */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block", marginBottom: "4px" }}>
                      Choose Starting Template
                    </label>
                    <select
                      className="select"
                      style={{ width: "100%", background: "#fff", padding: "6px 10px", fontSize: "13px" }}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const all = [...templates.builtin, ...templates.custom];
                        const found = all.find((t) => t.id === val);
                        if (found) applyTemplate(found);
                      }}
                      defaultValue=""
                    >
                      <option value="">-- Choose Built-in or Custom Template --</option>
                      <optgroup label="📌 Built-in Templates">
                        {templates.builtin.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                      {templates.custom.length > 0 && (
                        <optgroup label="⭐ My Custom Saved Templates">
                          {templates.custom.map((t) => (
                            <option key={t.id} value={t.id}>
                              ★ {t.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end", height: "100%", paddingTop: "18px" }}>
                    <button
                      type="button"
                      className="btn tiny"
                      onClick={() => setShowSaveTemplateModal(true)}
                      title="Save current layout as a reusable template"
                    >
                      💾 Save as Template
                    </button>
                  </div>
                </div>

                {/* 2. Recipient Targeting Selector */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "6px" }}>
                    Audience Targeting
                  </label>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="targeting"
                        checked={targetingMode === "segment"}
                        onChange={() => setTargetingMode("segment")}
                      />
                      <span>Event Segment</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="targeting"
                        checked={targetingMode === "family"}
                        onChange={() => setTargetingMode("family")}
                      />
                      <span>Specific Family / Group</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="targeting"
                        checked={targetingMode === "direct"}
                        onChange={() => setTargetingMode("direct")}
                      />
                      <span>Direct Email(s)</span>
                    </label>
                  </div>

                  {targetingMode === "segment" && (
                    <select
                      className="select"
                      value={form.target}
                      onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
                    >
                      {segments.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}

                  {targetingMode === "family" && (
                    <select
                      className="select"
                      value={selectedFamilyId}
                      onChange={(e) => setSelectedFamilyId(e.target.value)}
                    >
                      <option value="">-- Select a registered family --</option>
                      {families.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.leader}) — {f.email || "No email"}
                        </option>
                      ))}
                    </select>
                  )}

                  {targetingMode === "direct" && (
                    <input
                      className="input"
                      placeholder="e.g. pastor@church.org, coordinator@retreatflow.com (comma-separated)"
                      value={directEmails}
                      onChange={(e) => setDirectEmails(e.target.value)}
                    />
                  )}
                </div>

                {/* Audience counter pill */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#334155",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    👥 <strong>Targeted:</strong>{" "}
                    {audienceLoading
                      ? "Calculating..."
                      : `${audienceCount ?? 0} recipient(s) will receive this email`}
                  </div>
                  {smtpStatus?.connected && (
                    <span style={{ fontSize: "11px", color: "#15803d", fontWeight: "700" }}>
                      🟢 Live SMTP ({smtpStatus.host})
                    </span>
                  )}
                </div>

                {/* 3. Personalization Merge Tags Helper */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "700" }}>Email Subject *</label>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>Click tag below to insert into message</span>
                  </div>
                  <input
                    className="input"
                    value={form.subject}
                    onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="e.g. Important Retreat Update for {{family}}"
                    required
                  />

                  {/* Clickable Merge Tag Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                    {mergeTags.map((mt) => (
                      <button
                        key={mt.tag}
                        type="button"
                        onClick={() => insertMergeTag(mt.tag)}
                        style={{
                          background: "#e0e7ff",
                          border: "1px solid #c7d2fe",
                          color: "#3730a3",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          cursor: "pointer",
                          fontWeight: "600",
                        }}
                        title={`Insert ${mt.desc}`}
                      >
                        + {mt.tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Message Body */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700" }}>Message Body *</label>
                  <textarea
                    ref={bodyInputRef}
                    className="input"
                    rows={7}
                    value={form.body}
                    onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                    placeholder="Dear {{name}},\n\nWrite your customized announcement, packing tips, or event updates here..."
                    required
                    style={{ width: "100%", fontFamily: "inherit" }}
                  ></textarea>
                </div>

                {/* 5. Collapsible Advanced Callout & Action Button */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedDesign((p) => !p)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "#f8fafc",
                      border: 0,
                      textAlign: "left",
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#334155",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <span>🎨 Custom Notice Card & Call-To-Action Button (Optional)</span>
                    <span>{showAdvancedDesign ? "▲" : "▼"}</span>
                  </button>

                  {showAdvancedDesign && (
                    <div style={{ padding: "14px", background: "#ffffff", display: "grid", gap: "10px" }}>
                      <div>
                        <label style={{ fontSize: "12px", color: "#475569" }}>
                          Special Highlight Box / Notice Note:
                        </label>
                        <input
                          className="input"
                          value={form.calloutNote}
                          onChange={(e) => setForm((p) => ({ ...p, calloutNote: e.target.value }))}
                          placeholder="e.g. ⚠️ Please arrive 15 minutes early for registration at the chapel."
                          style={{ fontSize: "13px" }}
                        />
                      </div>

                      <div className="formgrid">
                        <div>
                          <label style={{ fontSize: "12px", color: "#475569" }}>Action Button Label:</label>
                          <input
                            className="input"
                            value={form.buttonText}
                            onChange={(e) => setForm((p) => ({ ...p, buttonText: e.target.value }))}
                            placeholder="e.g. View Weekend Schedule"
                            style={{ fontSize: "13px" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "12px", color: "#475569" }}>Action Button URL Link:</label>
                          <input
                            className="input"
                            value={form.buttonUrl}
                            onChange={(e) => setForm((p) => ({ ...p, buttonUrl: e.target.value }))}
                            placeholder="e.g. https://lightoftheworldpa.org/retreat"
                            style={{ fontSize: "13px" }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Test Email Toolbar */}
                <div
                  style={{
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={form.sendEmail}
                        onChange={(e) => setForm((p) => ({ ...p, sendEmail: e.target.checked }))}
                      />
                      <span>Deliver live email notifications via SMTP</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowTestInput((p) => !p)}
                      style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
                    >
                      {showTestInput ? "Hide Test Email" : "🧪 Send Test Email"}
                    </button>
                  </div>

                  {showTestInput && (
                    <div style={{ display: "flex", gap: "8px", background: "#eff6ff", padding: "10px", borderRadius: "8px", alignItems: "center" }}>
                      <input
                        className="input"
                        type="email"
                        placeholder="Enter your email to receive preview"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        style={{ flex: 1, fontSize: "13px" }}
                      />
                      <button
                        type="button"
                        className="btn tiny primary"
                        onClick={handleSendTest}
                        disabled={testSending}
                      >
                        {testSending ? "Sending Test..." : "Send Test"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Live Email Inbox Preview Tab */
              <div>
                <div style={{ marginBottom: "12px", fontSize: "13px", color: "#64748b" }}>
                  This is how your customized branded email will appear in your attendees' mail inboxes:
                </div>

                {previewLoading ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    Generating email preview...
                  </div>
                ) : (
                  <div
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: "#0f172a",
                      maxHeight: "520px",
                      overflowY: "auto",
                    }}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                )}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn" disabled={loading} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              {activeTab === "preview" ? (
                <button className="btn" onClick={() => setActiveTab("compose")}>
                  ← Back to Compose
                </button>
              ) : null}
              <button className="btn primary" disabled={loading} onClick={handleSend}>
                {loading
                  ? "Sending Emails..."
                  : `Send to ${audienceCount ?? "Audience"} Recipient(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Details / History Preview Modal */}
      {selectedMessage && (
        <div className="modalbg show" onClick={() => setSelectedMessage(null)}>
          <div className="modal" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ margin: 0 }}>Message Details</h2>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
              <div style={{ marginBottom: "6px" }}>
                <strong>Subject:</strong> {selectedMessage.subject}
              </div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Audience:</strong> {selectedMessage.target}
              </div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Date Sent:</strong> {selectedMessage.sent}
              </div>
              <div>
                <strong>Recipients Reached:</strong> {selectedMessage.recipientCount || 1}
              </div>
            </div>

            {selectedMessage.body && (
              <div style={{ marginBottom: "16px" }}>
                <strong style={{ fontSize: "13px", display: "block", marginBottom: "6px" }}>Message Body:</strong>
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    padding: "14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    color: "#334155",
                  }}
                >
                  {selectedMessage.body}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => {
                  setForm({
                    target: selectedMessage.target,
                    subject: selectedMessage.subject,
                    body: selectedMessage.body || "",
                    buttonText: "",
                    buttonUrl: "",
                    calloutNote: "",
                    sendEmail: true,
                  });
                  setSelectedMessage(null);
                  setShowModal(true);
                }}
              >
                Reuse / Resend
              </button>
              <button className="btn primary" onClick={() => setSelectedMessage(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Top Section */}
      <div className="top">
        <div>
          <h1>Communications & Notifications</h1>
          <div className="sub">
            {event?.name ? `${event.name} · ` : ""}Automated email reminders, custom announcements, and template builder.
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => openCompose()}>
            + Compose Message
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid cards4">
        <div className="card metric">
          <div className="label">Total Messages Sent</div>
          <div className="value">{messages.length}</div>
          <div className="delta green">Dispatched to community</div>
        </div>

        <div className="card metric">
          <div className="label">Total Emails Delivered</div>
          <div className="value green">{totalDelivered}</div>
          <div className="delta">Via Hostinger SMTP</div>
        </div>

        <div className="card metric">
          <div className="label">Saved Templates</div>
          <div className="value">{templates.builtin.length + templates.custom.length}</div>
          <div className="delta">{templates.custom.length} custom created</div>
        </div>

        <div className="card metric">
          <div className="label">Email Delivery Status</div>
          <div className="value" style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "6px" }}>
            {smtpStatus?.connected ? (
              <>
                <span style={{ color: "#16a34a" }}>●</span> Connected
              </>
            ) : smtpStatus ? (
              <>
                <span style={{ color: "#ea580c" }}>●</span> Simulation Mode
              </>
            ) : (
              "Checking..."
            )}
          </div>
          <div className="delta">
            {smtpStatus?.host ? smtpStatus.host : "Standard SMTP Gateway"}
          </div>
        </div>
      </div>

      {/* Quick Segments Grid */}
      <div className="grid cards2 section">
        <div className="card panel">
          <div className="section-title">Quick Target Segments</div>
          <div className="quick">
            {segments.map((seg) => (
              <button key={seg} onClick={() => openCompose(seg)}>
                <b>{seg}</b>
                <span>
                  {seg === "Pending payments"
                    ? "Send balance due notices"
                    : seg === "Incomplete registrations"
                    ? "Remind missing waivers & fields"
                    : seg === "Volunteers"
                    ? "Notify shifts & roles"
                    : "Send targeted broadcast"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card panel">
          <div className="section-title">Email Customization & Personalization</div>
          <div className="small" style={{ lineHeight: "1.7", color: "#475569" }}>
            You can create custom emails anytime or build on top of templates:
          </div>
          <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "13px" }}>
              <span style={{ color: "#2563eb", fontWeight: "700" }}>✓</span>
              <div>
                <strong>Dynamic Merge Tags:</strong> Personalize your message with <code>{"{{name}}"}</code>, <code>{"{{family}}"}</code>, <code>{"{{dates}}"}</code>, and <code>{"{{balance}}"}</code>.
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "13px" }}>
              <span style={{ color: "#2563eb", fontWeight: "700" }}>✓</span>
              <div>
                <strong>Custom CTA Button:</strong> Add clickable action buttons (e.g. schedule links, payment links, external forms).
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "13px" }}>
              <span style={{ color: "#2563eb", fontWeight: "700" }}>✓</span>
              <div>
                <strong>Reusable Templates:</strong> Click <em>"Save as Template"</em> to save any customized email to your library.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message History Table */}
      <div className="card panel section">
        <div className="section-title">Message Dispatch History</div>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Audience / Target</th>
                <th>Subject</th>
                <th>Delivered</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.target}</b>
                  </td>
                  <td>
                    <div>{m.subject}</div>
                    {m.body && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          maxWidth: "340px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {m.body}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: "700", color: "#2563eb" }}>
                      {m.recipientCount !== undefined ? `${m.recipientCount} email(s)` : "Delivered"}
                    </span>
                  </td>
                  <td>{m.sent}</td>
                  <td>
                    <span
                      className={`pill ${
                        m.status === "Sent" || m.status === "Delivered" ? "confirmed" : "pending"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button className="btn tiny" onClick={() => setSelectedMessage(m)}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No messages sent yet. Use the Compose Message button above to send your first event announcement!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
