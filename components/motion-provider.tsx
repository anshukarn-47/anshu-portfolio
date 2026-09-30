"use client";

import { MotionConfig } from "framer-motion";

/**
 * reducedMotion="user": when the visitor prefers reduced motion, framer-motion
 * skips transform and layout animations (including layoutId morphs) and jumps
 * to the final state.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
