import { AuthLayout } from "@velo/ui/composed";
import Link from "next/link";
import { loginErrorMessage } from "@velo/app-core/auth-errors";
import { getTenantLabelWords } from "@velo/app-core/tenant";
import { getRequestTenantContext } from "@velo/app-core/tenant-server";
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

export default async function DriverLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(readParam(params?.next));
  const initialError = loginErrorMessage(readParam(params?.error));
  const { branding } = await getRequestTenantContext();
  const words = getTenantLabelWords(branding);

  return (
    <AuthLayout
      product={words.driver}
      statement={`Go online, accept ${words.tripsWord} and track every payout.`}
      title="Sign in to drive"
      description={`Manage your availability, ${words.tripsWord} and earnings.`}
      footer={
        <>
          <span>New to Velo?</span>
          <Link className="secondary-button" href="/register">
            Apply to drive
          </Link>
        </>
      }
    >
      <LoginForm nextPath={nextPath} initialError={initialError} />
    </AuthLayout>
  );
}
