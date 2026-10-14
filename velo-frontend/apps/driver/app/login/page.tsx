import { AuthLayout } from "@velo/ui/composed";
import Link from "next/link";
import { LoginForm } from "./_components/login-form";
import { sanitizeNextPath } from "./_lib/redirect";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

function readNextParam(searchParams: Awaited<LoginPageProps["searchParams"]>): string | null {
  const nextValue = searchParams?.next;
  if (Array.isArray(nextValue)) {
    return typeof nextValue[0] === "string" ? nextValue[0] : null;
  }
  return typeof nextValue === "string" ? nextValue : null;
}

export default async function DriverLoginPage({ searchParams }: LoginPageProps) {
  const nextPath = sanitizeNextPath(readNextParam(await searchParams));

  return (
    <AuthLayout
      product="Driver"
      statement="Go online, accept trips and track every payout."
      title="Sign in to drive"
      description="Manage your availability, trips and earnings."
      footer={
        <>
          <span>New to Velo?</span>
          <Link className="secondary-button" href="/register">
            Apply to drive
          </Link>
        </>
      }
    >
      <LoginForm nextPath={nextPath} />
    </AuthLayout>
  );
}
