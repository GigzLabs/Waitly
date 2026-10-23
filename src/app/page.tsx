import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Lockup } from "@/components/logo";
import { FloorVignette, LiveListVignette, NotificationVignette, PeakVignette, QueueVignette, SourcesVignette, TurnoverVignette } from "@/components/marketing/vignettes";

export const metadata: Metadata = {
  title: "Waitly · Every table, in real time",
  description: "Waitly shows restaurants which tables are free, seated or waiting to be cleaned, alerts staff before a guest is forgotten, predicts the next free table for the line at the door and shows peak hours for staffing.",
};

const GUTTER = { paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" } as const;

const FEATURES = [
  {
    id: "live-floor",
    eyebrow: "Live floor",
    title: "A camera that monitors your tables",
    body: ["Every table is a ring: green when it is free, red once guests sit down, and a timer starts the moment they arrive.", "The host stand, every server's phone and the office see the same floor at the same second."],
    vignette: <LiveListVignette />,
  },
  {
    id: "no-forgotten-guest",
    eyebrow: "Server tracking",
    title: "No forgotten guest",
    body: ["If a party has been seated for five minutes and no server has stopped by, Waitly sends an alert that names the exact table.", "One tap on Server arrived clears it and records how long the greeting took."],
    vignette: <NotificationVignette />,
  },
  {
    id: "tables-ready-faster",
    eyebrow: "Table turnover",
    title: "Tables ready faster",
    body: ["When guests leave, the table turns amber and the busser is alerted to reset it, so the next party is not standing at the door while a clean table sits empty.", "Mark cleaned turns it green and Waitly keeps the turnaround time for the weekly review."],
    vignette: <TurnoverVignette />,
  },
  {
    id: "next-free-table",
    eyebrow: "Waiting queue",
    title: "The next free table",
    body: ["With a line at the entrance, the host sees which table should free up first, based on how long parties of that size usually stay in your room, not a guess.", "Quotes come from the same prediction, and guests can join from a QR code and watch their place in line."],
    vignette: <QueueVignette />,
  },
  {
    id: "peak-times",
    eyebrow: "Weekly review",
    title: "Your peak times",
    body: ["At the end of the week, managers see occupancy by hour, the hours that peak, and how many servers each hour needs.", "Time to greet, turnaround and dining duration sit beside it, so the schedule is built on what actually happened."],
    vignette: <PeakVignette />,
  },
  {
    id: "no-new-equipment",
    eyebrow: "Works with what you have",
    title: "No new equipment",
    body: ["Waitly runs on staff taps from day one and gets more automatic when you connect the camera that is already on the ceiling, or your POS, through a simple API.", "Any system that can say which table is occupied, empty or being served can drive the floor."],
    vignette: <SourcesVignette />,
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "per month, per location",
    blurb: "The live floor for one room.",
    items: ["1 location, unlimited tables", "Staff taps on any device", "Alerts for greeting and cleaning", "Waitlist with next-free-table prediction", "Weekly insights and staffing"],
    cta: "Try it on the demo floor",
    href: "/app/floor",
    featured: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "per month, per location",
    blurb: "Automatic with cameras and POS.",
    items: ["Everything in Starter", "Camera AI and POS integrations", "Guest QR waitlist with live position", "Unlimited devices and staff", "Priority support"],
    cta: "Try it on the demo floor",
    href: "/app/floor",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual agreement",
    blurb: "Groups and multi-location operators.",
    items: ["Multi-location dashboard", "Single sign-on", "Data export and reporting API", "Uptime SLA and onboarding", "Dedicated contact"],
    cta: "Talk to us",
    href: "#contact",
    featured: false,
  },
];

const FAQ = [
  { q: "Do I need cameras?", a: "No. Waitly works with staff taps from the first shift. Cameras and POS make it more automatic, and they plug in through the same API, including the security cameras you already have." },
  { q: "Which tablets and phones does it run on?", a: "Any modern browser. Add it to the home screen on an iPad at the host stand and on servers' phones; it installs as an app and opens straight on the floor." },
  { q: "Where is our data stored?", a: "On your own server. Waitly keeps its state in a JSON file by default and is ready to move to Postgres. Nothing leaves your infrastructure unless you connect it." },
  { q: "Can guests join the waitlist from their phone?", a: "Yes. Print a QR code to your /join page. Guests enter their name and party size, see their position and the live estimate, and are told when the table is ready." },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-6" style={GUTTER}>
          <Link href="/" aria-label="Waitly home" className="flex items-center">
            <Lockup size={28} />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-ink-2 md:flex" aria-label="Site">
            <a href="#features" className="hover:text-ink">
              Features
            </a>
            <a href="#how" className="hover:text-ink">
              How it works
            </a>
            <a href="#pricing" className="hover:text-ink">
              Pricing
            </a>
          </nav>
          <Link href="/app/floor" className="btn btn-primary ml-auto">
            Open the live demo
          </Link>
        </div>
      </header>

      <main className="flex flex-col">
        {/* Hero */}
        <section className="mx-auto w-full max-w-[1120px] pb-16 pt-14 md:pb-24 md:pt-24" style={GUTTER}>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
            <div className="flex flex-col gap-6">
              <div className="eyebrow">For restaurants</div>
              <h1 className="text-[44px] font-extrabold leading-[0.98] tracking-[-0.03em] md:text-[64px] md:leading-[1.03]">Every table, in real time.</h1>
              <p className="max-w-[52ch] text-[17px] leading-relaxed text-ink-2">Waitly shows which tables are free, seated or waiting to be cleaned, alerts staff before a guest is forgotten, predicts the next free table for the line at the door and shows peak hours for staffing.</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/app/floor" className="btn btn-primary btn-lg">
                  Open the live demo <ArrowRight size={18} />
                </Link>
                <Link href="/join" className="btn btn-secondary btn-lg">
                  See the guest waitlist
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-ink-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-free" /> Free
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-seated" /> Seated, timer since arrival
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-cleaning" /> Needs cleaning
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-next" /> Next free table
                </span>
              </div>
            </div>
            <FloorVignette />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border bg-surface/60">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-16 py-16 md:gap-24 md:py-24" style={GUTTER}>
            <div className="max-w-[60ch]">
              <div className="eyebrow">What the floor sees</div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-[40px] md:leading-tight">Six things a host stand should know without asking.</h2>
            </div>
            {FEATURES.map((f, i) => (
              <article key={f.id} id={f.id} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
                <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                  <div className="eyebrow">{f.eyebrow}</div>
                  <h3 className="mt-2 text-3xl font-bold tracking-tight md:text-[36px] md:leading-tight">{f.title}</h3>
                  <div className="mt-4 flex max-w-[56ch] flex-col gap-3 text-[16px] leading-relaxed text-ink-2">
                    {f.body.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </div>
                <div className={`flex justify-center ${i % 2 === 1 ? "lg:order-1" : ""}`}>{f.vignette}</div>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-border">
          <div className="mx-auto w-full max-w-[1120px] py-16 md:py-24" style={GUTTER}>
            <div className="max-w-[60ch]">
              <div className="eyebrow">How it works</div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-[40px] md:leading-tight">Running by the next service.</h2>
            </div>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                { n: "1", t: "Draw your floor", b: "Add sections, tables and seats in Settings. Give each section a server. Set the greeting and cleaning thresholds you want to hold the room to." },
                { n: "2", t: "Tap, or connect", b: "Staff seat, greet, release and clean with one tap each. When you are ready, point the cameras you already have or your POS at the ingest API and the taps become automatic." },
                { n: "3", t: "Every device, one floor", b: "The host stand, the servers' phones and the office all open the same floor. A change on one is on all of them within a second, and the alerts follow the people who own the section." },
              ].map((s) => (
                <li key={s.n} className="card flex flex-col gap-3 p-6">
                  <span className="tnum grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-base font-extrabold text-brand">{s.n}</span>
                  <h3 className="text-xl font-bold tracking-tight">{s.t}</h3>
                  <p className="text-[15px] leading-relaxed text-ink-2">{s.b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-border bg-surface/60">
          <div className="mx-auto w-full max-w-[1120px] py-16 md:py-24" style={GUTTER}>
            <div className="max-w-[60ch]">
              <div className="eyebrow">Launch pricing</div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-[40px] md:leading-tight">Priced per room, not per table.</h2>
              <p className="mt-3 text-[16px] text-ink-2">Launch pricing while the first venues go live. Plans and prices are placeholders to adjust before you sell; every plan includes a 30-day trial on your own floor.</p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PLANS.map((p) => (
                <div key={p.name} className={`card flex flex-col gap-5 p-6 ${p.featured ? "border-brand shadow-md" : ""}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold tracking-tight">{p.name}</h3>
                    {p.featured && <span className="pill !border-transparent !bg-brand-soft !text-brand">Most chosen</span>}
                  </div>
                  <div>
                    <div className="tnum text-4xl font-extrabold tracking-tight">{p.price}</div>
                    <div className="text-xs font-semibold text-ink-3">{p.period}</div>
                  </div>
                  <p className="text-sm text-ink-2">{p.blurb}</p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {p.items.map((it) => (
                      <li key={it} className="flex items-start gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  {p.href.startsWith("#") ? (
                    <a href={p.href} className={`btn mt-auto ${p.featured ? "btn-primary" : "btn-secondary"}`}>
                      {p.cta}
                    </a>
                  ) : (
                    <Link href={p.href} className={`btn mt-auto ${p.featured ? "btn-primary" : "btn-secondary"}`}>
                      {p.cta}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border">
          <div className="mx-auto w-full max-w-[1120px] py-16 md:py-24" style={GUTTER}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div>
                <div className="eyebrow">Questions</div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-[40px] md:leading-tight">Before the first shift.</h2>
              </div>
              <dl className="flex flex-col divide-y divide-border">
                {FAQ.map((f) => (
                  <div key={f.q} className="py-5">
                    <dt className="text-lg font-bold tracking-tight">{f.q}</dt>
                    <dd className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Final call */}
        <section className="border-t border-border bg-surface/60">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col items-start gap-6 py-16 md:flex-row md:items-center md:justify-between md:py-20" style={GUTTER}>
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-[36px]">See the demo floor live.</h2>
              <p className="mt-2 max-w-[52ch] text-[16px] text-ink-2">A busy Friday service runs on its own: tables turn, alerts arrive, the queue moves. Tap any table to try the actions.</p>
            </div>
            <Link href="/app/floor" className="btn btn-primary btn-lg shrink-0">
              Open the live demo <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between" style={GUTTER}>
          <div className="flex flex-col gap-2">
            <Lockup size={24} />
            <p className="text-sm text-ink-2">Built for the floor.</p>
            <p className="text-xs text-ink-3">Sales and support: replace this line with your contact details before launch.</p>
          </div>
          <nav className="flex flex-wrap gap-5 text-sm font-semibold text-ink-2" aria-label="Footer">
            <Link href="/app/floor" className="hover:text-ink">
              Live demo
            </Link>
            <Link href="/join" className="hover:text-ink">
              Guest waitlist
            </Link>
            <a href="#features" className="hover:text-ink">
              Features
            </a>
            <a href="#pricing" className="hover:text-ink">
              Pricing
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
