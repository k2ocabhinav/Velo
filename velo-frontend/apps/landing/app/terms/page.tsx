import type { Metadata } from "next";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@velo.dev";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for using the Velo pre-launch website and requesting a demo.",
  alternates: { canonical: "/terms/" },
};

export default function TermsPage() {
  return (
    <>
      <Navbar home={false} />
      <main className="legal-page section-light">
        <div className="container legal-content">
          <p className="section-kicker">Velo pre-launch</p>
          <h1 className="section-heading">Terms</h1>
          <p>
            Velo is pre-launch software. This site describes a working demo and a product in
            development. A demo request does not create an account, subscription, or service
            agreement.
          </p>
          <p>
            Product details, availability, and early-access pricing may change. Any pilot or paid
            use will be covered by written terms agreed with Velo before it begins.
          </p>
          <p>
            For questions about these terms, email{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </div>
      </main>
      <Footer home={false} />
    </>
  );
}
