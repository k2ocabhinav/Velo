import Link from "next/link";
import { AuthLayout } from "@velo/ui/composed";
import { loginErrorMessage } from "@velo/app-core/auth-errors";
import { LoginForm } from "./_components/login-form";
import { sanitizeNextPath } from "./_lib/redirect";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }
  return typeof value === "string" ? value : null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(readParam(params?.next));
  const initialError = loginErrorMessage(readParam(params?.error));

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
      <LoginForm nextPath={nextPath} initialError={initialError} />
    </AuthLayout>
  );
}
