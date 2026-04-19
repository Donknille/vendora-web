"use client";

import { motion, useReducedMotion } from "motion/react";

export function AnimatedLogo() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="inline-flex items-center mb-6"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src="/vendora_logo_v1_transparent.png"
        alt="Vendora"
        className="h-14 w-auto block dark:hidden"
      />
      <img
        src="/vendora_logo_v2_transparent.png"
        alt="Vendora"
        className="h-14 w-auto hidden dark:block"
      />
      {/* eslint-enable @next/next/no-img-element */}
    </motion.div>
  );
}
