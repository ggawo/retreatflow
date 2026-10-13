"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";

export interface ActionDropdownItem {
  id: string;
  label: string;
  icon?: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  description?: string;
}

interface ActionDropdownProps {
  label?: string;
  icon?: string;
  items: ActionDropdownItem[];
  variant?: "primary" | "secondary" | "outline";
  align?: "left" | "right";
  className?: string;
}

export default function ActionDropdown({
  label = "Actions",
  icon,
  items,
  variant = "secondary",
  align = "right",
  className = "",
}: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const buttonClass = variant === "primary" ? "btn primary" : "btn";

  return (
    <div
      ref={dropdownRef}
      className={`action-dropdown-wrap ${className}`}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        className={buttonClass}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          userSelect: "none",
        }}
      >
        {icon && <span style={{ fontSize: "14px" }}>{icon}</span>}
        <span>{label}</span>
        <span
          style={{
            fontSize: "11px",
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            display: "inline-block",
            color: "inherit",
            opacity: 0.75,
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          className="action-dropdown-menu"
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            [align === "right" ? "right" : "left"]: 0,
            minWidth: "220px",
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e4e7ec",
            boxShadow: "0 12px 30px rgba(16, 24, 40, 0.16)",
            padding: "6px",
            zIndex: 60,
            animation: "dropdownFadeIn 0.15s ease-out",
          }}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return (
                <div
                  key={`div-${idx}`}
                  style={{
                    height: "1px",
                    background: "#e4e7ec",
                    margin: "5px 4px",
                  }}
                />
              );
            }

            const itemStyle: React.CSSProperties = {
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "9px 12px",
              fontSize: "13px",
              fontWeight: 600,
              color: item.danger ? "#bd3328" : "#172033",
              background: "transparent",
              border: 0,
              borderRadius: "8px",
              textAlign: "left",
              cursor: item.disabled ? "not-allowed" : "pointer",
              opacity: item.disabled ? 0.5 : 1,
              textDecoration: "none",
              transition: "background 0.12s ease, color 0.12s ease",
            };

            const handleItemClick = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              if (item.disabled) return;
              setIsOpen(false);
              if (item.onClick) {
                item.onClick();
              }
            };

            const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
              if (!item.disabled) {
                e.currentTarget.style.background = item.danger ? "#fdecea" : "#f5f7fb";
              }
            };

            const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
              e.currentTarget.style.background = "transparent";
            };

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  style={itemStyle}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={handleItemClick}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  {item.icon && <span style={{ fontSize: "15px", flexShrink: 0 }}>{item.icon}</span>}
                  <div style={{ flex: 1 }}>
                    <div>{item.label}</div>
                    {item.description && (
                      <div style={{ fontSize: "11px", fontWeight: 400, color: "#667085" }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                style={itemStyle}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleItemClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                {item.icon && <span style={{ fontSize: "15px", flexShrink: 0 }}>{item.icon}</span>}
                <div style={{ flex: 1 }}>
                  <div>{item.label}</div>
                  {item.description && (
                    <div style={{ fontSize: "11px", fontWeight: 400, color: "#667085" }}>
                      {item.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
