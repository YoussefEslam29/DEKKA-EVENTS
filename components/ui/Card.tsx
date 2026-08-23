"use client";

import { useEffect, useRef, useState } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { useMotionPresets, type PressableProps } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The card surface, re-exported from `Surface.tsx` so no import site had to
 * change. It lives in its own file because it is the one surface primitive
 * that needs to be a client component — the press feedback from
 * `lib/motion.ts` is a hook, and `PageHeader`/`Badge`/`EmptyState` have no
 * reason to leave the server just to keep it company.
 *
 * Colours still come from the `dk-*` classes in globals.css, which flip
 * automatically inside a `.dk-workspace` ancestor, so the same Card renders
 * dark on the public app and cream in the back-office.
 */
export function Card({ className, ...props }: HTMLMotionProps<"div">) {
  const { pressable } = useMotionPresets();
  const ref = useRef<HTMLDivElement>(null);
  const [inClickable, setInClickable] = useState(false);

  // Card is the shared surface for two different things: things you click
  // (KPI tiles, event rows, staff picker rows — always wrapped in a <Link>)
  // and static panels full of form fields (EventForm, DoorTable, About).
  // Press feedback belongs on the first kind only — shrinking a whole form
  // panel because someone tapped an input inside it would be a bug, not
  // polish. Nothing in the props distinguishes the two, so ask the DOM once on
  // mount. First render is identical on server and client, so this can't cause
  // a hydration mismatch.
  useEffect(() => {
    setInClickable(Boolean(ref.current?.closest("a, button")));
  }, []);

  const feedback: PressableProps = inClickable || props.onClick ? pressable : {};

  return (
    <motion.div ref={ref} className={cn("dk-card", className)} {...feedback} {...props} />
  );
}
