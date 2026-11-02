import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { SiteHeader } from "@/components/layout/site-header";
import { PageTitle } from "@/components/common/text";
import { TextLink } from "@/components/common/text-link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <PageContainer>
        <PageTitle>Page not found</PageTitle>
        <p className="my-4">This page does not exist. It may have moved.</p>
        <p className="my-4">
          <TextLink href="/">Go to the LendLoop home page</TextLink>
        </p>
      </PageContainer>
    </>
  );
}
