import Link from "next/link";
import { AuthLayout } from "@velo/ui/composed";
import { registerErrorMessage } from "@velo/app-core/auth-errors";
import { getTenantLabelWords } from "@velo/app-core/tenant";
import { getRequestTenantContext } from "@velo/app-core/tenant-server";
import { Suspense } from "react";
import { RegisterForm } from "./_components/register-form";

type RegisterPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }
  return typeof value === "string" ? value : null;
}

export default async function DriverRegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const initialError = registerErrorMessage(readParam(params?.error));
  const { branding } = await getRequestTenantContext();
  const words = getTenantLabelWords(branding);

  return (
    <AuthLayout
      product={words.driver}
      statement={`Go online, accept ${words.tripsWord} and track every payout.`}
      title="Apply to drive"
      description="Create your account and add your vehicle. An admin reviews every application."
      footer={
        <>
          <span>Already applied?</span>
          <Link className="secondary-button" href="/login">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<p className="helper">Loading the application form…</p>}>
        <RegisterForm initialError={initialError} />
      </Suspense>
    </AuthLayout>
  );
}
