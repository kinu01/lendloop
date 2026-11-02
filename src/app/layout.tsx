import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/components/common/convex-client-provider";
import "./globals.css";

const publicSans = localFont({
  src: "./fonts/public-sans-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-public-sans",
});

const DESCRIPTION = "Borrow what you need. Lend what you don't.";

// Clerk's default greets a first-time visitor with "Welcome back!".
const CLERK_TEXT = {
  signIn: {
    start: { subtitle: "Use your email or Google account to continue." },
  },
};

export const metadata: Metadata = {
  title: { default: "LendLoop", template: "%s | LendLoop" },
  description: DESCRIPTION,
  openGraph: { title: "LendLoop", description: DESCRIPTION, type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // The CSP nonce is per request, so no page can be prerendered.
  await connection();
  return (
    <html lang="en" className={publicSans.variable}>
      <body className="bg-background text-foreground">
        <ClerkProvider dynamic localization={CLERK_TEXT}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
