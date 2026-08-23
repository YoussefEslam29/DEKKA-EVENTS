"use client";

import { motion } from "framer-motion";
import { useMotionPresets } from "@/lib/motion";

/**
 * Thin `"use client"` wrappers around the presets in `lib/motion.ts`.
 *
 * They exist so a server component can animate its shell without becoming a
 * client component itself: the page keeps rendering on the server and only
 * hands the finished markup to one of these as `children`.
 */

type MotionBlockProps = {
  className?: string;
  children: React.ReactNode;
};

/**
 * Page/section entrance. Wrap the `PageHeader` + first content block of a
 * screen; it plays once on mount.
 */
export function FadeUp({ className, children }: MotionBlockProps) {
  const { fadeUp } = useMotionPresets();
  return (
    <motion.div className={className} variants={fadeUp} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

/** Container for a list of `<StaggerItem>`s. */
export function Stagger({ className, children }: MotionBlockProps) {
  const { staggerContainer } = useMotionPresets();
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

/** One item in a `<Stagger>`. Inherits the reveal timing from its container. */
export function StaggerItem({ className, children }: MotionBlockProps) {
  const { staggerItem } = useMotionPresets();
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

/**
 * `<tbody>` flavour of `<Stagger>` — a real table needs real table elements, so
 * the generic `<div>` version can't be reused here.
 */
export function StaggerRows({ className, children }: MotionBlockProps) {
  const { staggerContainer } = useMotionPresets();
  return (
    <motion.tbody
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.tbody>
  );
}

/** `<tr>` flavour of `<StaggerItem>`. */
export function StaggerRow({ className, children }: MotionBlockProps) {
  const { staggerItem } = useMotionPresets();
  return (
    <motion.tr className={className} variants={staggerItem}>
      {children}
    </motion.tr>
  );
}
