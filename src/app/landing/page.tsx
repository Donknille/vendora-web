import Link from "next/link";
import { AnimatedLogo } from "./_components/AnimatedLogo";
import { HeroHeadline } from "./_components/HeroHeadline";
import { MeshGradient } from "./_components/MeshGradient";
import { FeatureGrid } from "./_components/FeatureGrid";
import { PricingBox } from "./_components/PricingBox";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-page">
      {/* Hero */}
      <header className="relative mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
        <MeshGradient />

        <AnimatedLogo />

        <HeroHeadline />

        <p className="mt-4 text-lg text-muted max-w-xl mx-auto">
          Aufträge, Rechnungen, Marktverkäufe und Ausgaben — alles an einem Ort.
          Für Marktverkäufer, Kreative und Kleinunternehmer.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="rounded-xl bg-brand-primary px-8 py-3.5 text-base font-semibold text-white hover:bg-brand-primary/90 transition-colors shadow-lg shadow-brand-primary/20"
          >
            Kostenlos testen — 6 Wochen gratis
          </Link>
          <Link
            href="/auth/login"
            className="rounded-xl border border-line px-8 py-3.5 text-base font-medium text-secondary hover:bg-elevated transition-colors"
          >
            Anmelden
          </Link>
        </div>

        <p className="mt-3 text-sm text-faint">Keine Kreditkarte nötig. Danach nur 2,99 €/Monat.</p>
      </header>

      {/* Features Grid */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <FeatureGrid />
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <PricingBox />
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-6 py-8 border-t border-line">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted">
          <span>© {new Date().getFullYear()} Vendora — DigitalFlowSolutions</span>
          <div className="flex gap-4">
            <Link href="/legal/impressum" className="hover:text-primary transition-colors">Impressum</Link>
            <Link href="/legal/datenschutz" className="hover:text-primary transition-colors">Datenschutz</Link>
            <Link href="/legal/agb" className="hover:text-primary transition-colors">AGB</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
