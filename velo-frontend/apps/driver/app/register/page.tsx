import Link from "next/link";
import { AuthLayout } from "@velo/ui/composed";
import { Suspense } from "react";
import { RegisterForm } from "./_components/register-form";

export default function DriverRegisterPage() {
  return (
    <AuthLayout
      product="Driver"
      statement="Go online, accept trips and track every payout."
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
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  );
}
