"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/simulate", label: "Simulate" },
  { href: "/reports", label: "Reports" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 2L26 8V20L14 26L2 20V8L14 2Z"
                stroke="url(#logo-gradient)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M14 8L20 11V17L14 20L8 17V11L14 8Z"
                fill="url(#logo-gradient)"
                opacity="0.6"
              />
              <defs>
                <linearGradient
                  id="logo-gradient"
                  x1="2"
                  y1="2"
                  x2="26"
                  y2="26"
                >
                  <stop stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className={styles.logoText}>
            Helium<span className={styles.logoAccent}>Trader</span>
          </span>
        </Link>

        <div className={`${styles.links} ${mobileOpen ? styles.open : ""}`}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.link} ${
                pathname === link.href ? styles.active : ""
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
              {pathname === link.href && (
                <span className={styles.activeIndicator} />
              )}
            </Link>
          ))}
        </div>

        <div className={styles.actions}>
          <Link href="/dashboard" className="btn btn-primary btn-sm">
            Launch App
          </Link>

          <button
            className={styles.mobileToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span
              className={`${styles.hamburger} ${
                mobileOpen ? styles.hamburgerOpen : ""
              }`}
            />
          </button>
        </div>
      </div>
    </nav>
  );
}
