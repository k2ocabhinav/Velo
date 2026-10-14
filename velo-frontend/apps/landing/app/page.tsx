import { Footer } from "./components/Footer";
import { Navbar } from "./components/Navbar";
import { BrandSwitcher } from "./sections/BrandSwitcher";
import { DemoContact } from "./sections/DemoContact";
import { FAQ } from "./sections/FAQ";
import { FollowTransfer } from "./sections/FollowTransfer";
import { FounderNote } from "./sections/FounderNote";
import { GettingStarted } from "./sections/GettingStarted";
import { Hero } from "./sections/Hero";
import { MorningOfTransfers } from "./sections/MorningOfTransfers";
import { Pricing } from "./sections/Pricing";
import { TimeSpine } from "./sections/TimeSpine";
import { VerifyToday } from "./sections/VerifyToday";
import styles from "./sections/sections.module.css";

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar />
      <TimeSpine />
      <main id="main">
        <Hero />
        <MorningOfTransfers />
        <FollowTransfer />
        <BrandSwitcher />
        <GettingStarted />
        <VerifyToday />
        <Pricing />
        <FounderNote />
        <FAQ />
        <DemoContact />
      </main>
      <Footer />
    </div>
  );
}
