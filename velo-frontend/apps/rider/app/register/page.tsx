import Link from "next/link";
import { AuthLayout } from "@velo/ui/composed";
import { RegisterForm } from "./_components/register-form";
import { sanitizeNextPath } from "../login/_lib/redirect";

type RegisterPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

function readNextParam(searchParams: Awaited<RegisterPageProps["searchParams"]>): string | null {
  const nextValue = searchParams?.next;
  if (Array.isArray(nextValue)) {
    return typeof nextValue[0] === "string" ? nextValue[0] : null;
  }
  return typeof nextValue === "string" ? nextValue : null;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const nextPath = sanitizeNextPath(readNextParam(await searchParams));

  return (
    <AuthLayout
      product="Rider"
      statement="Request a trip and follow it from pickup to drop-off."
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
      <RegisterForm nextPath={nextPath} />
    </AuthLayout>
  );
}
