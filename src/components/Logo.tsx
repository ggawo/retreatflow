import Image from "next/image";
import Link from "next/link";
import React from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  textSize?: number | string;
  href?: string;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  glow?: boolean;
}

export default function Logo({
  size = 32,
  showText = true,
  textSize,
  href,
  className = "",
  style,
  priority = false,
  glow = false,
}: LogoProps) {
  const content = (
    <div
      className={`logo-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size > 40 ? "12px" : "10px",
        textDecoration: "none",
        cursor: href ? "pointer" : "default",
        userSelect: "none",
        ...style,
      }}
    >
      <div
        className="logo-mark-wrap"
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: glow
            ? "drop-shadow(0 0 14px rgba(99, 102, 241, 0.45))"
            : "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15))",
          transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease",
        }}
      >
        <Image
          src="/logo-sm.png"
          alt="RetreatFlow Logo"
          width={size}
          height={size}
          priority={priority}
          style={{
            objectFit: "contain",
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      </div>

      {showText && (
        <span
          className="brand-text"
          style={{
            fontWeight: 800,
            fontSize: textSize ?? (size >= 48 ? "28px" : size >= 36 ? "22px" : "19px"),
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: "#ffffff",
          }}
        >
          Retreat<span style={{ color: "#9e9eff" }}>Flow</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", display: "inline-flex" }}>
        {content}
      </Link>
    );
  }

  return content;
}
