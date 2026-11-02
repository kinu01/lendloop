import { UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminLink } from "@/components/layout/admin-link";
import { MainNav } from "@/components/layout/main-nav";
import { PageContainer } from "@/components/layout/page-container";
import { SessionGate } from "@/components/layout/session-gate";
import { SessionProvider } from "@/components/layout/session-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SkipLink />
      <SiteHeader
        end={
          <div className="flex items-center gap-4">
            <AdminLink />
            <UserButton />
          </div>
        }
      >
        <MainNav />
      </SiteHeader>
      <PageContainer tabIndex={-1}>
        <SessionGate>{children}</SessionGate>
      </PageContainer>
    </SessionProvider>
  );
}
