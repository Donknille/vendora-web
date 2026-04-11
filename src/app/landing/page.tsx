import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Store, Receipt, BarChart3, FileText, Shield } from "lucide-react";

const features = [
  { icon: ShoppingCart, title: "Aufträge verwalten", desc: "Kunden, Positionen, Status-Tracking von offen bis geliefert." },
  { icon: FileText, title: "Rechnungen erstellen", desc: "Automatische Rechnungsnummern, PDF-Export mit deinem Firmenprofil." },
  { icon: Store, title: "Märkte tracken", desc: "Standgebühren, Fahrtkosten, Schnellverkauf per Tap — Gewinn live berechnet." },
  { icon: Receipt, title: "Ausgaben erfassen", desc: "7 Kategorien, Monatsübersicht, alles an einem Ort." },
  { icon: BarChart3, title: "Dashboard & GuV", desc: "Umsatz, Ausgaben, Nettogewinn — Jahresfilter und PDF-Export." },
  { icon: Shield, title: "Sicher & privat", desc: "Deine Daten gehören dir. Kein Tracking, keine Werbung, DSGVO-konform." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-page">
      {/* Hero */}
      <header className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center mb-6">
          <Image src="/Vendora.png" alt="Vendora" width={200} height={52} className="h-14 w-auto" priority />
        </div>

        <h1 className="font-display text-4xl md:text-5xl text-primary leading-tight max-w-2xl mx-auto">
          Dein Business. <br className="hidden md:block" />
          <span className="text-brand-primary">Einfach verwaltet.</span>
        </h1>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-xl border border-line bg-surface p-6 hover:border-brand-teal/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-brand-tealLt flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-brand-tealDark" />
                </div>
                <h3 className="font-display text-lg text-primary mb-1">{feature.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-brand-teal/20 bg-surface p-8 text-center">
          <p className="text-sm font-medium text-brand-teal uppercase tracking-wider mb-2">Ein Plan. Alles drin.</p>
          <div className="flex items-baseline justify-center gap-1 mb-4">
            <span className="font-display text-5xl text-primary">2,99 €</span>
            <span className="text-muted">/Monat</span>
          </div>
          <ul className="space-y-2 text-sm text-secondary text-left mb-6">
            <li className="flex items-center gap-2"><span className="text-brand-teal">✓</span> Unbegrenzte Aufträge & Rechnungen</li>
            <li className="flex items-center gap-2"><span className="text-brand-teal">✓</span> Unbegrenzte Märkte & Verkäufe</li>
            <li className="flex items-center gap-2"><span className="text-brand-teal">✓</span> Ausgabenverwaltung</li>
            <li className="flex items-center gap-2"><span className="text-brand-teal">✓</span> Dashboard & GuV-Export</li>
            <li className="flex items-center gap-2"><span className="text-brand-teal">✓</span> Backup & Restore</li>
            <li className="flex items-center gap-2"><span className="text-brand-teal">✓</span> Deutsch & Englisch</li>
          </ul>
          <Link
            href="/auth/register"
            className="block w-full rounded-xl bg-brand-primary px-6 py-3 text-base font-semibold text-white hover:bg-brand-primary/90 transition-colors"
          >
            6 Wochen kostenlos testen
          </Link>
          <p className="mt-2 text-xs text-faint">Jederzeit kündbar. Keine versteckten Kosten.</p>
        </div>
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
