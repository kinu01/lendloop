"use client";

import { ErrorMessage } from "@/components/common/error-message";
import { PageContainer } from "@/components/layout/page-container";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <PageContainer>
      <ErrorMessage reset={reset} />
    </PageContainer>
  );
}
