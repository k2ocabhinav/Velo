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
    <main className="form-shell">
      <section className="card login-card">
        <div className="stack">
          <div>
            <p className="helper">Velo Rider</p>
            <h1 style={{ margin: "8px 0 0", fontSize: "28px", lineHeight: 1.1 }}>Create account</h1>
            <p className="helper" style={{ marginTop: "8px" }}>
              Register to request rides and manage your trips.
            </p>
          </div>
          <RegisterForm nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
