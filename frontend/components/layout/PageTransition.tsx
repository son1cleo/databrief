"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // The app shell scrolls an inner <main>, not the window, so Next's own
  // scroll-to-top on navigation has nothing to reset -- without this, a route
  // change would render the new page already scrolled to wherever the previous
  // one was left. Keyed by pathname in the layout, so this runs per navigation.
  useEffect(() => {
    ref.current?.closest("[data-app-scroll]")?.scrollTo({ top: 0 });
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
