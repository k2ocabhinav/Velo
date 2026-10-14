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
      product="Admin"
      statement="Run dispatch, approvals and payouts for your fleet."
      title="Sign in to Velo Admin"
      description="Use your admin credentials to reach the operations dashboard."
    >
      <LoginForm nextPath={nextPath} />
    </AuthLayout>
  );
}
