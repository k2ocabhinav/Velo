import { LoginForm } from "./_components/login-form";
import { Suspense } from "react";

export default function LoginPage() {
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
          <Suspense fallback={<p className="helper">Loading sign-in form...</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
