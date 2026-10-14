import type { Metadata } from "next";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
const contactFormAction = process.env.NEXT_PUBLIC_CONTACT_FORM_ACTION?.trim();

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
          {(contactFormAction || contactEmail) ? (
            <>
              <p>
                The demo request form asks for your name, phone or WhatsApp number, and fleet size.
                City, preferred time and email are optional. Please do not include confidential or
                sensitive information.
              </p>
              <p>
                {contactFormAction
                  ? "When you submit, Velo sends these details to the configured form service to reply to your enquiry and arrange a demo."
                  : <>When you submit, your email app opens a draft addressed to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. It is sent only if you choose to send it.</>}
              </p>
            </>
          ) : (
            <p>No demo request form is available in this build, so the site does not collect demo request details.</p>
          )}
          {contactEmail
            ? <p>To ask about, correct, or request deletion of details you sent, email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
            : <p>No contact email is published in this build.</p>}
        </div>
      </main>
      <Footer home={false} />
    </>
  );
}
