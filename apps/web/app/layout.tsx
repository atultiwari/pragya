import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
import { NavLinks } from "./NavLinks";

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
          <NavLinks />
        </nav>
        {children}
      </body>
    </html>
  );
}
