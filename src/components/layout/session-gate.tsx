"use client";

import { SignOutButton } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { AnnouncerProvider } from "@/components/common/announcer";
import { ErrorText } from "@/components/common/error-text";
import { Loading } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/common/row";
import { useSession } from "@/hooks/use-session";

export function SessionGate({ children }: { children: ReactNode }) {
  const { isLoading, isReady, error, needsSignIn, retry } = useSession();
  return (
    <>
      {error ? (
        <div className="mt-6 grid gap-3 text-muted-foreground">
          <ErrorText message={error} />
          <Row>
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          </Row>
        </div>
      ) : null}
      {needsSignIn ? (
        <div className="mt-6 grid gap-3 text-muted-foreground">
          <p role="alert" className="mb-2">
            We could not confirm your sign-in. Sign out, then sign in again.
          </p>
          <Row>
            <SignOutButton>
              <Button variant="outline">Sign out</Button>
            </SignOutButton>
          </Row>
        </div>
      ) : null}
      {isLoading ? <Loading /> : null}
      {isReady ? <AnnouncerProvider>{children}</AnnouncerProvider> : null}
    </>
  );
}
