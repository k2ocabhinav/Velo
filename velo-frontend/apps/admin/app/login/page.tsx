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
      product="Admin"
      statement="Run dispatch, approvals and payouts for your fleet."
      title="Sign in to Velo Admin"
      description="Use your admin credentials to reach the operations dashboard."
    >
      <LoginForm nextPath={nextPath} initialError={initialError} />
    </AuthLayout>
  );
}
