"use client";

import { motion } from "motion/react";
import { useReducedMotionSafe } from "@/lib/hooks/useReducedMotionSafe";
import { Logo } from "@/components/Logo";

export function AnimatedLogo() {
  const reduceMotion = useReducedMotionSafe();

  return (
    <motion.div
      className="inline-flex items-center mb-6"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Logo className="h-14 w-auto" />
    </motion.div>
  );
}
