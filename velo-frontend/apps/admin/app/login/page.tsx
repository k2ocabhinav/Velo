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
    <main className="form-shell">
      <section className="panel login-card">
        <div className="stack">
          <div>
            <p className="helper">Velo Admin</p>
            <h1 style={{ margin: "8px 0 0", fontSize: "28px", lineHeight: 1.1 }}>Sign in</h1>
            <p className="helper" style={{ marginTop: "8px" }}>
              Use your admin credentials to reach the operations dashboard.
            </p>
          </div>
          <LoginForm nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
