import type { Metadata } from "next";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Terms — Velo",
  description: "Pre-launch terms information for the Velo landing site.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar home={false} />
      <main className="legal-page section section-light">
        <div className="container legal-content">
          <p className="section-kicker">Pre-launch policy</p>
          <h1 className="section-heading">Terms</h1>
          <p>Velo is pre-launch software. This site describes a product under development; requesting a demo does not create an account or a service agreement.</p>
          <p>The site collects no personal information beyond details you choose to submit through the contact form. Any pilot or paid service will have written terms agreed directly with the operator before use.</p>
          <p>For questions about these terms, email <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@velo.dev"}`}>{process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@velo.dev"}</a>.</p>
        </div>
      </main>
      <Footer home={false} />
    </>
  );
}
