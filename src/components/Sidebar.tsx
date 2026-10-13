"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import Logo from "@/components/Logo";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  badgeType?: "live" | "count" | "default";
}

interface NavGroup {
  id: string;
  title?: string;
  icon?: string;
  phaseTag?: string;
  isDirectLink?: boolean;
  href?: string;
  badge?: string;
  badgeType?: "live" | "count" | "default";
  items?: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: "overview",
    isDirectLink: true,
    title: "Dashboard",
    icon: "📊",
    href: "/",
  },
  {
    id: "planning",
    title: "Planning & Setup",
    icon: "📁",
    items: [
      { id: "/registration", label: "Registration", icon: "📝" },
      { id: "/families", label: "Families & Groups", icon: "👥" },
      { id: "/rooms", label: "Room Assignment", icon: "🏢" },
    ],
  },
  {
    id: "onsite",
    title: "On-Site Operations",
    icon: "🎪",
    items: [
      { id: "/kiosk", label: "Check-in Kiosk", icon: "📱", badge: "Live", badgeType: "live" },
      { id: "/attendance", label: "Attendance Roster", icon: "📋" },
      { id: "/schedule", label: "Schedule", icon: "📅" },
      { id: "/volunteers", label: "Volunteers & Teams", icon: "🤝" },
    ],
  },
  {
    id: "finance",
    title: "Finance & Comms",
    icon: "💳",
    items: [
      { id: "/payments", label: "Payments & Invoicing", icon: "💳" },
      { id: "/communications", label: "Email Broadcasts", icon: "💬" },
      { id: "/reports", label: "Reports & Analytics", icon: "📈" },
    ],
  },
  {
    id: "admin",
    isDirectLink: true,
    title: "Settings & Event Pass",
    icon: "⚙️",
    href: "/settings",
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavClick?: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const [eventInfo, setEventInfo] = useState<{ name: string; organizationName?: string; date: string; location: string } | null>(null);

  // Accordion state: which category group is currently expanded
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    planning: true,
    onsite: false,
    finance: false,
  });

  useEffect(() => {
    fetch("/api/event")
      .then(res => res.json())
      .then(data => {
        if (data && data.name) setEventInfo(data);
      })
      .catch(() => {});
  }, [pathname]);

  const isActive = (id: string) => {
    if (id === "/") return pathname === "/";
    return pathname.startsWith(id);
  };

  // Smart auto-expand: expand whichever group contains the active route
  useEffect(() => {
    for (const group of navGroups) {
      if (group.items && group.items.some(item => isActive(item.id))) {
        setOpenGroups({ [group.id]: true });
        break;
      }
    }
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    if (collapsed) {
      // In collapsed mode, clicking an accordion group expands the sidebar
      onToggleCollapse?.();
      setOpenGroups({ [groupId]: true });
      return;
    }

    setOpenGroups(prev => {
      const isCurrentlyOpen = !!prev[groupId];
      // Accordion toggle: if currently open, close it; otherwise open it & close others
      return isCurrentlyOpen ? {} : { [groupId]: true };
    });
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top-bar">
        <div className="brand brand-title" style={{ padding: collapsed ? "4px 0" : "0", display: "flex", alignItems: "center" }}>
          <Logo
            size={collapsed ? 36 : 30}
            showText={!collapsed}
            href="/"
            priority
            glow
          />
        </div>
        <button 
          type="button" 
          className="collapse-toggle" 
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 3v18"/>
              <path d="m14 9 3 3-3 3"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 3v18"/>
              <path d="m16 15-3-3 3-3"/>
            </svg>
          )}
        </button>
      </div>

      <div className="event-mini" style={{ position: "relative" }}>
        <div style={{ overflow: "hidden" }}>
          <strong>{eventInfo?.name || "2026 Family Summer Retreat"}</strong>
          {eventInfo?.organizationName && (
            <div style={{ fontSize: "11px", color: "#a5b4fc", fontWeight: 600, marginTop: "2px" }}>
              {eventInfo.organizationName}
            </div>
          )}
        </div>
        <span style={{ marginTop: "4px", display: "block" }}>{eventInfo?.date || "July 24–26, 2026"} · {eventInfo?.location || "Camp Hope"}</span>
      </div>

      <div className="nav">
        {navGroups.map((group) => {
          // Direct Link (e.g. Dashboard or Settings)
          if (group.isDirectLink && group.href) {
            const active = isActive(group.href);
            return (
              <div key={group.id} className="nav-group direct-nav-group">
                <Link
                  href={group.href}
                  className={active ? "active" : ""}
                  onClick={onNavClick}
                  title={group.title}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span className="icon" style={{ fontSize: "16px", minWidth: "22px", flexShrink: 0 }}>{group.icon}</span>
                    <span className="label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.title}</span>
                  </span>
                </Link>
              </div>
            );
          }

          // Expandable Accordion Phase Group
          const isGroupOpen = !!openGroups[group.id];
          const hasActiveChild = group.items?.some(item => isActive(item.id)) ?? false;

          return (
            <div key={group.id} className="nav-group accordion-nav-group">
              <button
                type="button"
                className={`nav-group-btn ${isGroupOpen ? "is-open" : ""} ${hasActiveChild ? "has-active" : ""}`}
                onClick={() => toggleGroup(group.id)}
                title={group.title}
                aria-expanded={isGroupOpen}
              >
                <div className="nav-group-btn-left">
                  <span className="icon nav-group-icon" style={{ fontSize: "15px", minWidth: "20px" }}>{group.icon}</span>
                  <span className="label nav-group-title">{group.title}</span>
                </div>

                <div className="nav-group-btn-right">
                  {group.badge && (
                    <span className={group.badgeType === "live" ? "nav-badge-live" : "badge"}>
                      {group.badge}
                    </span>
                  )}
                  <svg 
                    className={`nav-chevron ${isGroupOpen ? "rotated" : ""}`} 
                    width="13" 
                    height="13" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Collapsible Children Container */}
              <div className={`nav-group-collapsible ${isGroupOpen ? "is-open" : ""}`}>
                <div className="nav-group-collapsible-inner">
                  {group.items?.map((item) => (
                    <Link
                      key={item.id}
                      href={item.id}
                      className={isActive(item.id) ? "active sub-nav-item" : "sub-nav-item"}
                      onClick={onNavClick}
                      title={item.label}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span className="icon" style={{ fontSize: "15px", minWidth: "20px", flexShrink: 0 }}>{item.icon}</span>
                        <span className="label" style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      </span>
                      {item.badge && (
                        <span className={item.badgeType === "live" ? "nav-badge-live" : "badge"}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #2b304c" }}>
        <button 
          onClick={handleSignOut}
          type="button" 
          style={{
            border: "0", 
            background: "transparent", 
            color: "#c8cce0",
            textAlign: "left", 
            padding: "9px 11px", 
            borderRadius: "9px",
            cursor: "pointer", 
            fontSize: "13.5px", 
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
          title="Sign Out"
        >
          <span className="icon" style={{ fontSize: "15px" }}>🚪</span>
          <span className="label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
