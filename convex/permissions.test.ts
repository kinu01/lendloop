import { anyApi, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  insertLoan,
  insertTool,
  makeUser,
  setup,
  tool,
  TODAY,
} from "./test.helpers";

afterEach(() => vi.useRealTimers());

type Caller = "signedOut" | "stranger" | "owner" | "borrower" | "admin";
type Outcome = "ok" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID";
type Expected = Record<Caller, Outcome>;

const PAGE = { paginationOpts: { numItems: 5, cursor: null } };

async function scene() {
  const t = setup();
  const [owner, borrower, stranger, admin] = await Promise.all([
    makeUser(t),
    makeUser(t),
    makeUser(t),
    makeUser(t, { role: "admin" }),
  ]);
  const toolId = await insertTool(t, owner.id, "Requested");
  const freeToolId = await insertTool(t, owner.id, "Free");
  const lentToolId = await insertTool(t, owner.id, "Lent");
  const pendingLoanId = await insertLoan(t, {
    toolId,
    borrowerId: borrower.id,
    ownerId: owner.id,
    startDate: "2026-06-16",
    endDate: "2026-06-17",
    status: "pending",
  });
  const activeLoanId = await insertLoan(t, {
    toolId: lentToolId,
    borrowerId: borrower.id,
    ownerId: owner.id,
    startDate: TODAY,
    endDate: "2026-06-17",
    status: "approved",
  });
  const callers = {
    signedOut: t,
    stranger: stranger.as,
    owner: owner.as,
    borrower: borrower.as,
    admin: admin.as,
  };
  return {
    callers,
    toolId,
    freeToolId,
    pendingLoanId,
    activeLoanId,
    ownerUserId: owner.id,
  };
}

type Scene = Awaited<ReturnType<typeof scene>>;

const anyone: Expected = {
  signedOut: "ok",
  stranger: "ok",
  owner: "ok",
  borrower: "ok",
  admin: "ok",
};
const signedIn: Expected = { ...anyone, signedOut: "UNAUTHENTICATED" };
const adminOnly: Expected = {
  signedOut: "UNAUTHENTICATED",
  stranger: "FORBIDDEN",
  owner: "FORBIDDEN",
  borrower: "FORBIDDEN",
  admin: "ok",
};
const ownerOnly: Expected = { ...adminOnly, owner: "ok", admin: "FORBIDDEN" };
const borrowerOnly: Expected = {
  ...adminOnly,
  borrower: "ok",
  admin: "FORBIDDEN",
};

const MATRIX: Record<
  string,
  { args: (s: Scene) => Record<string, unknown>; expected: Expected }
> = {
  "tools.listPublic": { args: () => ({ today: TODAY }), expected: anyone },
  "tools.list": { args: () => ({ today: TODAY, ...PAGE }), expected: signedIn },
  "tools.myListings": {
    args: () => ({ today: TODAY, ...PAGE }),
    expected: signedIn,
  },
  "tools.create": { args: () => tool(), expected: signedIn },
  "tools.update": {
    args: (s) => ({ toolId: s.toolId, ...tool() }),
    expected: ownerOnly,
  },
  "tools.remove": {
    args: (s) => ({ toolId: s.freeToolId }),
    expected: { ...adminOnly, owner: "ok" },
  },
  "loans.request": {
    args: (s) => ({
      toolId: s.freeToolId,
      startDate: "2026-06-20",
      endDate: "2026-06-21",
    }),
    expected: { ...signedIn, owner: "INVALID" },
  },
  "loans.cancel": {
    args: (s) => ({ loanId: s.pendingLoanId }),
    expected: borrowerOnly,
  },
  "loans.approve": {
    args: (s) => ({ loanId: s.pendingLoanId }),
    expected: ownerOnly,
  },
  "loans.decline": {
    args: (s) => ({ loanId: s.pendingLoanId }),
    expected: ownerOnly,
  },
  "loans.markReturned": {
    args: (s) => ({ loanId: s.activeLoanId }),
    expected: ownerOnly,
  },
  "loans.myRequests": {
    args: () => ({ today: TODAY, ...PAGE }),
    expected: signedIn,
  },
  "loans.incoming": {
    args: () => ({ today: TODAY, group: "pending", ...PAGE }),
    expected: signedIn,
  },
  "loans.waitingCount": { args: () => ({}), expected: signedIn },
  "loans.activity": {
    args: (s) => ({ loanId: s.pendingLoanId }),
    expected: {
      signedOut: "UNAUTHENTICATED",
      stranger: "FORBIDDEN",
      owner: "ok",
      borrower: "ok",
      admin: "ok",
    },
  },
  "users.store": { args: () => ({}), expected: signedIn },
  "users.me": { args: () => ({}), expected: signedIn },
  "admin.listTools": {
    args: () => ({ today: TODAY, ...PAGE }),
    expected: adminOnly,
  },
  "admin.listAllLoans": {
    args: () => ({ today: TODAY, ...PAGE }),
    expected: adminOnly,
  },
  "admin.listUsers": { args: () => PAGE, expected: adminOnly },
  "admin.listAutomationFailures": { args: () => PAGE, expected: adminOnly },
  "admin.setTrustedLender": {
    args: (s) => ({ userId: s.ownerUserId, trusted: true }),
    expected: adminOnly,
  },
};

const FUNCTION_FILES = import.meta.glob<Record<string, unknown>>(
  ["./*.ts", "!./*.test.ts", "!./test.*.ts", "!./*.config.ts"],
  { eager: true },
);
const MODULES = Object.fromEntries(
  Object.entries(FUNCTION_FILES).map(([file, exports]) => [
    file.replace(/^\.\/|\.ts$/g, ""),
    exports,
  ]),
);

type Registered = { isPublic?: boolean; isQuery?: boolean };

function publicFunctions(modules: Record<string, object>) {
  return Object.entries(modules).flatMap(([file, exports]) =>
    Object.entries(exports)
      .filter(([, value]) => (value as Registered)?.isPublic === true)
      .map(([name, value]) => ({
        path: `${file}.${name}`,
        isQuery: (value as Registered).isQuery === true,
      })),
  );
}

describe("the role matrix", () => {
  test("has a row for every public function", () => {
    const found = publicFunctions(MODULES).map((fn) => fn.path);
    expect(found.sort()).toEqual(Object.keys(MATRIX).sort());
  });

  test("automation, notification, reminder and seed functions are never public", () => {
    const internalFiles = ["automation", "notify", "reminders", "seed", "http"];
    const found = publicFunctions(MODULES).filter((fn) =>
      internalFiles.includes(fn.path.split(".")[0]!),
    );
    expect(found).toEqual([]);
  });

  const cases = publicFunctions(MODULES).flatMap(({ path, isQuery }) =>
    (Object.keys(anyone) as Caller[]).map((caller) => ({
      path,
      isQuery,
      caller,
    })),
  );

  test.each(cases)("$path as $caller", async ({ path, isQuery, caller }) => {
    const row = MATRIX[path];
    const s = await scene();
    const [file, name] = path.split(".") as [string, string];
    const ref = anyApi[file]![name]! as FunctionReference<"query">;
    const target = s.callers[caller];
    const run = isQuery
      ? target.query(ref, row!.args(s))
      : target.mutation(
          ref as unknown as FunctionReference<"mutation">,
          row!.args(s),
        );
    const outcome = await run.then(
      () => "ok",
      (error: { data?: { code?: string } }) => error.data?.code ?? "THREW",
    );
    expect(outcome).toBe(row!.expected[caller]);
  });
});
