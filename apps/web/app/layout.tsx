import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pragya — AI-powered learning",
  description:
    "AI-powered courses for MBBS, healthcare and beyond, for students, tutors and institutes.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="topnav" aria-label="Main">
          <Link href="/" className="brand">
            Pragya
          </Link>
          <span className="topnav-links">
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up" className="button-link">
              Create account
            </Link>
          </span>
        </nav>
        {children}
      </body>
    </html>
  );
}
