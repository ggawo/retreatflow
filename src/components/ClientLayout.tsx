"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Logo from "@/components/Logo";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isLoginPage = pathname === "/login";
  const isKioskPage = pathname.startsWith("/kiosk");
  const isPublicRegister = pathname.startsWith("/r/") || pathname === "/register";

  // Close mobile navigation menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isLoginPage || isKioskPage || isPublicRegister) {
    return <>{children}</>;
  }

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      {/* Mobile Top Navigation Bar */}
      <header className="mobile-header">
        <button 
          type="button" 
          className="mobile-nav-toggle" 
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
        <div className="mobile-brand" style={{ display: "flex", alignItems: "center" }}>
          <Logo size={28} textSize="18px" href="/" priority />
        </div>
        <div style={{ width: "38px" }} />
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        collapsed={collapsed} 
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onNavClick={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <main className="main">{children}</main>
    </div>
  );
}
