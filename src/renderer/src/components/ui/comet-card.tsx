import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@renderer/lib/utils";

interface CometCardProps extends React.HTMLAttributes<HTMLDivElement> {
  innerClassName?: string;
}

export const CometCard = React.forwardRef<HTMLDivElement, CometCardProps>(
  ({ className, innerClassName, children, onPointerDown, ...props }, ref) => {
    const [isHover, setIsHover] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const showComet = isHover || isActive;

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      setIsActive(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setIsActive(false), 900);
      onPointerDown?.(event);
    };

    return (
      <div
        ref={ref}
        onPointerEnter={() => setIsHover(true)}
        onPointerLeave={() => setIsHover(false)}
        onPointerDown={handlePointerDown}
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 transition-colors duration-300",
          "hover:border-neutral-700 hover:bg-neutral-900/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/40",
          className
        )}
        {...props}
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-white/5 to-transparent" />
        </div>

        <motion.div
          className="pointer-events-none absolute -top-10 left-1/2 h-20 w-56 -translate-x-1/2 rotate-45 bg-gradient-to-r from-transparent via-violet-400/80 to-transparent blur-2xl"
          animate={
            showComet
              ? { opacity: 1, x: ["-160%", "160%"] }
              : { opacity: 0, x: "-160%" }
          }
          transition={
            showComet
              ? { duration: 1.2, repeat: Infinity, ease: "linear" }
              : { duration: 0.2, ease: "linear" }
          }
        />

        <div className={cn("relative z-10", innerClassName)}>{children}</div>
      </div>
    );
  }
);

CometCard.displayName = "CometCard";
