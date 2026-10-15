import Link from "next/link";
import { AuthLayout } from "@velo/ui/composed";
import { registerErrorMessage } from "@velo/app-core/auth-errors";
import { getTenantLabelWords } from "@velo/app-core/tenant";
import { getRequestTenantContext } from "@velo/app-core/tenant-server";
import { RegisterForm } from "./_components/register-form";
import { sanitizeNextPath } from "../login/_lib/redirect";

type RegisterPageProps = {
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

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(readParam(params?.next));
  const initialError = registerErrorMessage(readParam(params?.error));
  const { branding } = await getRequestTenantContext();
  const words = getTenantLabelWords(branding);

  return (
    <AuthLayout
      product={words.rider}
      statement={`Request a ${words.tripWord} and follow it from pickup to drop-off.`}
      title="Create your account"
      description="It takes a minute. You can add a payment method later."
      footer={
        <>
          <span>Already have an account?</span>
          <Link className="secondary-button" href="/login">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm nextPath={nextPath} initialError={initialError} />
    </AuthLayout>
  );
}
