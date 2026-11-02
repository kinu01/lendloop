import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SkipLink } from "@/components/layout/skip-link";
import { Loading } from "@/components/common/loading";
import { AvailableTools } from "@/components/tools/available-tools";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { SiteHeader } from "@/components/layout/site-header";
import { SectionTitle } from "@/components/common/text";

export const metadata: Metadata = {
  title: { absolute: "LendLoop: borrow and lend tools with your neighbors" },
};

export default function Home() {
  return (
    <>
      <SkipLink />
      <SiteHeader
        brandCurrent
        end={
          <Show when="signed-in">
            <UserButton />
          </Show>
        }
      />
      <PageContainer tabIndex={-1}>
        <section className="pt-8 pb-4">
          <h1 className="mb-4 text-3xl font-bold">
            Borrow what you need. Lend what you don’t.
          </h1>
          <p className="my-4">
            LendLoop helps neighbors share tools instead of buying them.
          </p>
          <Show when="signed-out">
            <SignInButton mode="modal" forceRedirectUrl="/board">
              <Button>Sign in to lend or borrow</Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button asChild>
              <Link href="/board">Browse all tools</Link>
            </Button>
          </Show>
        </section>
        <section aria-labelledby="available-heading">
          <SectionTitle id="available-heading">Available now</SectionTitle>
          <Suspense fallback={<Loading label="Loading tools…" />}>
            <AvailableTools />
          </Suspense>
        </section>
      </PageContainer>
    </>
  );
}
