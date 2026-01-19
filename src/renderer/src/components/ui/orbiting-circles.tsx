"use client";

import { cn } from "../../lib/utils";
import React from "react";

export interface OrbitingCirclesProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  iconSize?: number;
  speed?: number;
}

export function OrbitingCircles({
  className,
  children,
  reverse = false,
  duration = 20,
  delay = 10,
  radius = 160,
  path = true,
  iconSize = 30,
  speed = 1,
  ...props
}: OrbitingCirclesProps) {
  const calculatedDuration = duration / speed;
  const childCount = React.Children.count(children);

  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle
            className="stroke-white/10 stroke-1"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
          />
        </svg>
      )}
      {React.Children.map(children, (child, index) => {
        const angle = (360 / childCount) * index;
        const animationDelay = -delay * index;
        
        return (
          <div
            style={{
              position: 'absolute',
              width: iconSize,
              height: iconSize,
              animation: `orbit ${calculatedDuration}s linear infinite ${reverse ? 'reverse' : 'normal'}`,
              animationDelay: `${animationDelay}s`,
              // Start position - each icon at different angle
              transform: `rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)`,
              // CSS custom properties for keyframes
              ['--radius' as string]: `${radius}px`,
              ['--angle' as string]: `${angle}deg`,
            }}
            className={cn(
              "flex transform-gpu items-center justify-center",
              className
            )}
            {...props}
          >
            {child}
          </div>
        );
      })}
      <style>{`
        @keyframes orbit {
          0% {
            transform: rotate(var(--angle, 0deg)) translateY(calc(-1 * var(--radius, 160px))) rotate(calc(-1 * var(--angle, 0deg)));
          }
          100% {
            transform: rotate(calc(var(--angle, 0deg) + 360deg)) translateY(calc(-1 * var(--radius, 160px))) rotate(calc(-1 * var(--angle, 0deg) - 360deg));
          }
        }
      `}</style>
    </>
  );
}
