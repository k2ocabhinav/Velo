import type { Metadata } from "next";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Privacy — Velo",
  description: "Pre-launch privacy information for the Velo landing site.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar home={false} />
      <main className="legal-page section section-light">
        <div className="container legal-content">
          <p className="section-kicker">Pre-launch policy</p>
          <h1 className="section-heading">Privacy</h1>
          <p>This site is a pre-launch product site. It has no account or customer portal and does not collect personal information beyond details you choose to send through the contact form.</p>
          <p>If the contact form is connected to a form service, the information you submit is sent to that service so the Velo team can respond to your enquiry. If no form endpoint is configured, the form opens your email app and you choose whether to send the message.</p>
          <p>To ask about or request deletion of information you sent, email <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@velo.dev"}`}>{process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@velo.dev"}</a>.</p>
        </div>
      </main>
      <Footer home={false} />
    </>
  );
}
