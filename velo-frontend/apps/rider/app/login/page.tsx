import Link from "next/link";
import { AuthLayout } from "@velo/ui/composed";
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath = sanitizeNextPath(readNextParam(await searchParams));

  return (
    <AuthLayout
      product="Rider"
      statement="Request a trip and follow it from pickup to drop-off."
      title="Sign in to ride"
      description="Book trips, track them live and manage payments."
      footer={
        <>
          <span>New to Velo?</span>
          <Link className="secondary-button" href="/register">
            Create a rider account
          </Link>
        </>
      }
    >
      <LoginForm nextPath={nextPath} />
    </AuthLayout>
  );
}
