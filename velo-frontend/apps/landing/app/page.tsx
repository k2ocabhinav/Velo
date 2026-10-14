import { ContactForm } from "./components/ContactForm";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
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
        <Hero />
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
