"use client";

import Link from "next/link";
import CountUp from "react-countup";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

const FEATURES = [
  "Unbegrenzte Aufträge & Rechnungen",
  "Unbegrenzte Märkte & Verkäufe",
  "Ausgabenverwaltung",
  "Dashboard & GuV-Export",
  "Backup & Restore",
  "Deutsch & Englisch",
];

export function PricingBox() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mx-auto max-w-md rounded-2xl border border-brand-primary/20 bg-surface p-8 text-center relative"
    >
      {/* Pulsing glow ring (CSS-only, respects motion-safe) */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl motion-safe:animate-glow-pulse pointer-events-none"
      />

      <p className="text-sm font-medium text-brand-primary uppercase tracking-wider mb-2 relative">
        Ein Plan. Alles drin.
      </p>
      <div className="flex items-baseline justify-center gap-1 mb-4 relative">
        <span className="text-5xl text-primary tabular-nums">
          {reduceMotion || !inView ? (
            "2,99 €"
          ) : (
            <>
              <CountUp end={2.99} duration={1.2} decimals={2} decimal="," />
              {" €"}
            </>
          )}
        </span>
        <span className="text-muted">/Monat</span>
      </div>
      <ul className="space-y-2 text-sm text-secondary text-left mb-6 relative">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="text-brand-primary">✓</span> {f}
          </li>
        ))}
      </ul>
      <Link
        href="/auth/register"
        className="block w-full rounded-xl bg-brand-primary px-6 py-3 text-base font-semibold text-white hover:bg-brand-primary/90 transition-colors relative"
      >
        6 Wochen kostenlos testen
      </Link>
      <p className="mt-2 text-xs text-faint relative">
        Jederzeit kündbar. Keine versteckten Kosten.
      </p>
    </motion.div>
  );
}
