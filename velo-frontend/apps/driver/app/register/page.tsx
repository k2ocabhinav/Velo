import { Suspense } from "react";
import { RegisterForm } from "./_components/register-form";

export default function DriverRegisterPage() {
  return (
    <main className="form-shell">
      <section className="card login-card">
        <div className="stack">
          <div>
            <p className="helper">Velo Driver</p>
            <h1 style={{ margin: "8px 0 0", fontSize: "28px", lineHeight: 1.1 }}>Create account</h1>
            <p className="helper" style={{ marginTop: "8px" }}>
              Register to start driving with Velo.
            </p>
          </div>
          <Suspense fallback={<p className="helper">Loading registration form...</p>}>
            <RegisterForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
