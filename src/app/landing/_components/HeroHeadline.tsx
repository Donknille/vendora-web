"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const WORDS = ["verwaltet", "abgerechnet", "geplant", "analysiert"];

export function HeroHeadline() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % WORDS.length);
    }, 2500);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <h1 className="text-4xl md:text-5xl text-primary leading-tight max-w-2xl mx-auto">
      Dein Business. <br className="hidden md:block" />
      <span className="text-brand-primary inline-block relative">
        Einfach{" "}
        {reduceMotion ? (
          <span>{WORDS[0]}.</span>
        ) : (
          <span className="relative inline-block align-baseline" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.span
                key={WORDS[index]}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="inline-block"
              >
                {WORDS[index]}.
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </span>
    </h1>
  );
}
