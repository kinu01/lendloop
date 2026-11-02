import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/common/row";
import { PageTitle } from "@/components/common/text";

export function ErrorMessage({ reset }: { reset: () => void }) {
  return (
    <>
      <title>Something went wrong | LendLoop</title>
      <PageTitle>Something went wrong</PageTitle>
      <p role="alert" className="my-4">
        This page could not load. Try again, or come back in a few minutes.
      </p>
      <Row>
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </Row>
    </>
  );
}
