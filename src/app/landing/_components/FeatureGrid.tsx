"use client";

import { motion, useReducedMotion } from "motion/react";
import { ShoppingCart, Store, Receipt, BarChart3, FileText, Shield, type LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const features: Feature[] = [
  { icon: ShoppingCart, title: "Aufträge verwalten", desc: "Kunden, Positionen, Status-Tracking von offen bis geliefert." },
  { icon: FileText, title: "Rechnungen erstellen", desc: "Automatische Rechnungsnummern, PDF-Export mit deinem Firmenprofil." },
  { icon: Store, title: "Märkte tracken", desc: "Standgebühren, Fahrtkosten, Schnellverkauf per Tap — Gewinn live berechnet." },
  { icon: Receipt, title: "Ausgaben erfassen", desc: "7 Kategorien, Monatsübersicht, alles an einem Ort." },
  { icon: BarChart3, title: "Dashboard & GuV", desc: "Umsatz, Ausgaben, Nettogewinn — Jahresfilter und PDF-Export." },
  { icon: Shield, title: "Sicher & privat", desc: "Deine Daten gehören dir. Kein Tracking, keine Werbung, DSGVO-konform." },
];

export function FeatureGrid() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((feature, i) => {
        const Icon = feature.icon;
        return (
          <motion.div
            key={feature.title}
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.45,
              delay: reduceMotion ? 0 : i * 0.08,
              ease: "easeOut",
            }}
            whileHover={
              reduceMotion
                ? undefined
                : { y: -4, transition: { duration: 0.2 } }
            }
            className="group rounded-xl border border-line bg-surface p-6 hover:border-brand-primary/30 hover:shadow-lg transition-[border-color,box-shadow]"
          >
            <motion.div
              whileHover={reduceMotion ? undefined : { rotate: 10, scale: 1.05 }}
              transition={{ duration: 0.2 }}
              className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center mb-4"
            >
              <Icon className="h-5 w-5 text-green-600" />
            </motion.div>
            <h3 className="text-lg text-primary mb-1">{feature.title}</h3>
            <p className="text-sm text-muted leading-relaxed">{feature.desc}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
