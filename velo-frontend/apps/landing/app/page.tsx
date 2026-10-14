import { ContactForm } from "./components/ContactForm";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { DispatchIllustration } from "@velo/ui/landing";
import { HowItWorks } from "./components/HowItWorks";
import { Navbar } from "./components/Navbar";
import { Pricing } from "./components/Pricing";
import { ProductScreens } from "./components/ProductScreens";
import { ProblemSolution } from "./components/ProblemSolution";

export default function LandingPage() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar />
      <main id="main">
        <div className="dispatch-review-mount">
          <Hero />
          <aside className="dispatch-review-visual" aria-label="Dispatch illustration preview">
            <DispatchIllustration />
          </aside>
          <style>{`
            .dispatch-review-mount { position: relative; }
            .dispatch-review-mount .hero-visual { visibility: hidden; }
            .dispatch-review-visual {
              position: absolute;
              z-index: 3;
              top: 50%;
              right: var(--side-space);
              width: min(47%, 660px);
              transform: translateY(-50%);
            }
            @media (max-width: 1023px) {
              .dispatch-review-mount .hero-visual { display: none; }
              .dispatch-review-visual {
                position: relative;
                top: auto;
                right: auto;
                width: calc(100% - 2 * var(--side-space));
                margin: 0 auto 3rem;
                transform: none;
              }
            }
          `}</style>
        </div>
        <ProblemSolution />
        <ProductScreens />
        <HowItWorks />
        <Pricing />
        <section className="contact-section section-dark" id="contact" aria-labelledby="contact-title">
          <div className="container contact-layout">
            <div className="contact-intro">
              <p className="section-kicker">Talk to the team</p>
              <h2 className="section-heading" id="contact-title">Tell us about your fleet.</h2>
              <p className="section-copy">Share how you handle pre-booked transfers today. We’ll arrange a walkthrough around your dispatch workflow.</p>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
