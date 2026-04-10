"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-lg p-2 text-faint hover:text-primary hover:bg-elevated transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold font-display text-primary">Impressum</h1>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">Angaben gemäß § 5 DDG</h2>
        <div className="space-y-1 text-sm text-secondary">
          <p className="font-medium text-primary">Sebastian Grüber</p>
          <p>DigitalFlowSolutions</p>
          <p>Falkenweg 6</p>
          <p>38820 Halberstadt</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">Kontakt</h2>
        <div className="space-y-1 text-sm text-secondary">
          <p>Telefon: 0173-5437573</p>
          <p>E-Mail: info@digitalflowsolutions.de</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">Umsatzsteuer</h2>
        <p className="text-sm text-secondary">
          Kleinunternehmer gemäß § 19 UStG. Es wird keine Umsatzsteuer berechnet und daher auch nicht ausgewiesen.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <div className="space-y-1 text-sm text-secondary">
          <p>Sebastian Grüber</p>
          <p>Falkenweg 6</p>
          <p>38820 Halberstadt</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">Streitschlichtung</h2>
        <p className="text-sm text-secondary">
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary hover:text-brand-primary/80"
          >
            https://ec.europa.eu/consumers/odr/
          </a>
        </p>
        <p className="text-sm text-secondary mt-2">
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Card>
    </div>
  );
}
