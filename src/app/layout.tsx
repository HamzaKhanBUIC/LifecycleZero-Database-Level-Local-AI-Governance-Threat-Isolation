import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LifecycleZero — Database-Level Local AI Governance",
  description:
    "B2B SaaS platform for monitoring local AI governance threats, hardware procurement lifecycle, and database-level endpoint isolation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const skipClerk = process.env.NEXT_PUBLIC_SKIP_CLERK === "true";
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const content = (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );

  // Only wrap with ClerkProvider when Clerk is explicitly enabled AND a valid key exists
  if (!skipClerk && publishableKey && publishableKey.startsWith("pk_")) {
    return <ClerkProvider publishableKey={publishableKey}>{content}</ClerkProvider>;
  }

  return content;
}

