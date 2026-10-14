import type { Metadata } from "next";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@velo.dev";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Velo uses the details you choose to share when requesting a demo.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar home={false} />
      <main className="legal-page section-light">
        <div className="container legal-content">
          <p className="section-kicker">Velo pre-launch</p>
          <h1 className="section-heading">Privacy</h1>
          <p>
            The demo request form asks for your name, phone or WhatsApp number, fleet size, city,
            and a preferred time. Email is optional. Please do not include confidential or sensitive
            information.
          </p>
          <p>
            Velo uses the details you submit to reply to your enquiry and arrange a demo. If a form
            service is configured, the form sends your details to that service. If no service is
            configured, your email app opens a draft addressed to{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>; it is sent only if you choose to
            send it.
          </p>
          <p>
            To ask about, correct, or request deletion of details you sent, email{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </div>
      </main>
      <Footer home={false} />
    </>
  );
}
