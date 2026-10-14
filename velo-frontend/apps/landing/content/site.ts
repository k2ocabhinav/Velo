const envValue = (value: string | undefined) => value?.trim() || undefined;

export const siteConfig = {
  contactFormAction: envValue(process.env.NEXT_PUBLIC_CONTACT_FORM_ACTION),
  contactEmail: envValue(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  whatsappNumber: envValue(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
  demoVideoUrl: envValue(process.env.NEXT_PUBLIC_DEMO_VIDEO_URL),
  founder: {
    name: envValue(process.env.NEXT_PUBLIC_FOUNDER_NAME),
    photoUrl: envValue(process.env.NEXT_PUBLIC_FOUNDER_PHOTO_URL),
    city: envValue(process.env.NEXT_PUBLIC_FOUNDER_CITY),
  },
  get demoContactAvailable() {
    return Boolean(this.contactFormAction || this.contactEmail || this.whatsappNumber);
  },
} as const;

/**
 * Single source for the numbers in the "What you can verify today" strip.
 * Keep these accurate: they are a claim on the page.
 */
export const verifyFacts = {
  landingChecksPassed: 6,
  landingChecksVerifiedOn: "2026-10-15",
  demoTenants: ["Velo Business", "Saffron Routes"],
} as const;

export const landingCopy = {
  hero: {
    title: "A dispatch desk for pre-booked business and hotel transfers.",
    description: "For fleets of 10–50 vehicles, anywhere. Manage pre-booked transfers, assign drivers and follow live trips in one branded web workspace.",
    stage: "Pre-launch. Working demo available.",
    bookDemo: "Book a demo",
    watchDemo: "Watch the 2-minute demo",
    seeHow: "See how it works",
    nextTransfer: "Next transfer",
    driverLabel: "Driver:",
    sampleFleet: "Demo fleet, sample data",
    mapCaption: "Schematic neighbourhood: three sample transfers",
  },
  timeSpine: [
    { time: "05:40", position: 0 },
    { time: "09:15", position: 25 },
    { time: "13:00", position: 50 },
    { time: "18:30", position: 75 },
    { time: "21:00", position: 100 },
  ],
  morning: {
    eyebrow: "Sample day",
    title: "A morning of transfers.",
    description: "Three bookings, one dispatch view. Follow the day from the first airport pickup to the evening return.",
    statusContext: "Trip status around 09:20",
    stages: ["Booked", "Driver assigned", "On trip", "Completed"],
    sampleNote: "These are illustrative trips with sample names.",
  },
  follow: {
    eyebrow: "How it works",
    title: "Follow one transfer from booking to record.",
    description: "The sequence stays clear for the operations team, the driver and the rider.",
    steps: [
      { title: "Booking", detail: "A transfer is requested with a pickup, destination and planned time.", image: "rider-booking.webp", alt: "Velo rider booking screen with pickup and destination controls", caption: "Rider booking" },
      { title: "Driver assignment", detail: "Dispatch reviews the request and assigns a driver from the workspace.", image: "velo-business-dispatch.webp", alt: "Velo Business dispatch workspace showing a pending request and active trip", caption: "Dispatch workspace" },
      { title: "Pickup check", detail: "The driver confirms the pickup with the trip's one-time code.", image: "driver-home.webp", alt: "Velo driver app home screen with trip offers and availability", caption: "Driver app" },
      { title: "Live trip updates", detail: "The trip's progress and driver location are available to dispatch and the rider.", image: "velo-business-dispatch.webp", alt: "Velo dispatch workspace showing a trip in progress", caption: "Live dispatch view" },
      { title: "Completed record", detail: "The trip remains available in the operator's records after completion.", image: "saffron-routes-dispatch.webp", alt: "Saffron Routes dispatch workspace with trip and dispatch audit records", caption: "Trip and dispatch records" },
    ],
  },
  brands: {
    eyebrow: "A familiar name at every step",
    title: "Your fleet's name on it.",
    description: "The rider, driver and dispatch workspace can carry an operator's name and brand colours.",
    tenants: [
      { id: "velo", name: "Velo Business", accent: "signal" },
      { id: "saffron", name: "Saffron Routes", accent: "teal" },
    ],
    previewLabel: "Rider booking preview",
    previewTitle: "Plan a transfer",
    pickup: "Pickup location",
    destination: "Where to?",
    continue: "Continue",
    chooseFleet: "Choose a demo fleet",
    sampleCaption: "Demo fleet, sample data",
  },
  gettingStarted: {
    eyebrow: "Getting started",
    title: "A practical first day, together.",
    description: "The pilot starts with the tools your team already carries and a working session around your dispatch routine.",
    needsTitle: "What your team needs",
    needs: ["A browser for the dispatch workspace", "A smartphone for each driver using the driver web app", "A list of the drivers and vehicles you want in the demo"],
    supportTitle: "What the founder does with you",
    support: ["Set up the operator's name and colours", "Import the first driver and vehicle details together", "Walk through a first live day and collect feedback"],
    link: "Talk through a pilot",
    exploreLink: "See how it works",
  },
  verify: {
    title: "What you can verify today.",
    description: "Check the current test scope and branded demo tenants.",
    groupLabel: "Verification facts",
    backend: "Automated backend test suite",
    backendScope: "Unit + integration",
    endToEnd: "Chromium landing checks · axe included",
    endToEndScope: "landing checks passed",
    checkedLabel: "checked",
    dateUnavailable: "Run date unavailable",
    tenants: "branded demo tenants",
  },
  pricing: {
    eyebrow: "Early-access pilot pricing",
    title: "A clear monthly price per active vehicle.",
    description: "One proposed rate for small transfer fleets. We'll confirm fit and terms together before a pilot.",
    currencies: ["USD", "EUR", "INR"] as const,
    perVehicle: "per active vehicle / month",
    activeVehicleNote: "We’ll confirm the active-vehicle count and monthly minimum with you before a pilot.",
    minimum: "monthly minimum",
    exampleLabel: "Worked example for 15 active vehicles",
    examplePrefix: "15 vehicles ×",
    taxes: "Local taxes extra.",
    caveat: "Early-access pilot pricing, subject to change.",
    includedTitle: "In the working demo",
    included: ["Branded dispatch, rider and driver web workspaces", "Trip requests, driver assignment and live trip status", "Weekly recurring trips and a daily trip sheet with CSV export", "Driver earnings and payout request management"],
    notIncludedTitle: "Not included yet",
    notIncluded: ["Corporate billing and monthly statements", "Native iOS or Android apps", "Payment gateway integration"],
  },
  founder: {
    eyebrow: "A note from the founder",
    title: "Built around the work between booking and pickup.",
    note: "I’m building Velo for small transfer fleets that need one place to plan pre-booked work, assign drivers and follow trip progress. The next step is working with the first pilot fleets.",
  },
  faq: {
    eyebrow: "Questions",
    title: "Before you book a walkthrough.",
    items: [
      { question: "Is Velo a web app or a native app?", answer: "The current dispatch, rider and driver experiences are web apps. Native iOS and Android apps are not available yet." },
      { question: "Can Velo repeat the same trip every week?", answer: "Yes. A weekly template creates the scheduled trips ahead of time, and the daily trip sheet shows which ones still need a driver." },
      { question: "When is support available?", answer: "Velo is pre-launch. Pilot support hours will be arranged directly with each fleet across its time zone." },
      { question: "How is fleet data handled today?", answer: "The current walkthrough uses demonstration records. Velo is not ready for production fleet data, and we will explain the pilot data setup before any real information is used." },
      { question: "Where is Velo hosted?", answer: "The working demo runs in a local demonstration setup. Production hosting is not yet available." },
      { question: "What does a pilot involve?", answer: "A setup call, a small initial driver and vehicle list, a walkthrough of one operating day, and regular feedback while the pilot is shaped." },
    ],
  },
  contact: {
    eyebrow: "Book a demo",
    title: "Tell us about your fleet.",
    unavailableTitle: "Demo contact isn’t available yet",
    description: "Share a good time and a little about your operation. The founder will coordinate a working demo with you.",
    unavailableDescription: "A demo booking contact has not been configured on this site yet.",
    name: "Your name",
    phone: "Phone or WhatsApp",
    fleetSize: "Fleet size",
    city: "City (optional)",
    preferredTime: "Preferred time and time zone (optional)",
    email: "Email (optional)",
    submit: "Send demo request",
    prepareEmail: "Prepare email",
    sending: "Sending request",
    privacy: "We'll use these details to respond to your demo request. Please do not include rider or driver personal data.",
    mailtoPrivacy: "Your email app opens a draft; your details are sent only if you choose to send it. Please do not include rider or driver personal data.",
    noContact: "No contact option is configured. No details were sent or saved.",
    mailto: "Your email app should open with the request addressed to {email}. Send that email to complete your request.",
    sent: "Thanks. Your request was sent. The founder will coordinate a demo time with you.",
    failed: "We couldn't send the request. Try again or use one of the contact options below.",
    timePlaceholder: "e.g. 14:00 UTC+1",
    whatsapp: "WhatsApp the founder",
    emailLink: "Email the founder",
    nextStep: "We'll agree on a time, then walk through a sample transfer day and the current working product.",
  },
} as const;

export function whatsappHref(number: string) {
  const digits = number.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : undefined;
}
