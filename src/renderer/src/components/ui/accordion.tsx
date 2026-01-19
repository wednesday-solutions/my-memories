"use client";

import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@renderer/lib/utils";

interface AccordionItemProps {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
    className?: string;
}

export function AccordionItem({
    title,
    children,
    defaultOpen = false,
    className,
}: AccordionItemProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div
            className={cn(
                "border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/30 backdrop-blur-sm",
                className
            )}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-800/30 transition-colors duration-200"
            >
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{title}</span>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="text-neutral-400"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </motion.div>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 text-sm text-neutral-300">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface AccordionProps {
    children: ReactNode;
    className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
    return (
        <div className={cn("flex flex-col gap-2", className)}>
            {children}
        </div>
    );
}
