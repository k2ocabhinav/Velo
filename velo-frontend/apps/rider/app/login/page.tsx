import { Suspense } from "react";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main className="form-shell">
      <section className="card login-card">
        <div className="stack">
          <div>
            <p className="helper">Velo Rider</p>
            <h1 style={{ margin: "8px 0 0", fontSize: "28px", lineHeight: 1.1 }}>Sign in</h1>
            <p className="helper" style={{ marginTop: "8px" }}>
              Access booking, scheduled rides, and notifications.
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
