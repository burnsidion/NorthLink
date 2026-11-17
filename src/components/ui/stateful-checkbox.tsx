"use client";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { WreathSpinner } from "./wreath-loader";
import { triggerPurchaseConfetti } from "@/lib/confetti-helpers";

interface StatefulCheckboxProps {
 checked: boolean;
 onChange: () => Promise<boolean>;
 className?: string;
 ariaLabel?: string;
}

export const StatefulCheckbox = ({ checked, onChange, className, ariaLabel }: StatefulCheckboxProps) => {
 const [isLoading, setIsLoading] = useState(false);
 const [celebrate, setCelebrate] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const inFlight = useRef(false);
 const mounted = useRef(true);
 useEffect(() => {
  mounted.current = true;
  return () => { mounted.current = false; };
 }, []);

 const handleClick = async () => {
  if (inFlight.current) return;
  inFlight.current = true;
  setIsLoading(true); setCelebrate(false); setError(null);
  try {
   // Save immediately; decoration never delays or decides persistence.
   const saved = await onChange();
   if (mounted.current && saved && !checked) {
    setCelebrate(true);
    const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) {
     try { triggerPurchaseConfetti(); } catch { /* Decoration cannot fail a saved purchase. */ }
    }
   }
  } catch {
   if (mounted.current) setError("Could not save. Please refresh and try again.");
  } finally {
   inFlight.current = false;
   if (mounted.current) setIsLoading(false);
  }
 };

 return <>
  {error && <span role="alert" className="ledger-error">{error}</span>}
  <span role="status" className="sr-only">{isLoading ? "Saving purchase status…" : ""}</span>
  <button type="button" aria-label={ariaLabel} aria-pressed={checked} aria-busy={isLoading}
   onClick={handleClick} disabled={isLoading}
   className={cn("ledger-purchase-control relative mt-1 h-5 w-5 rounded border transition-colors flex items-center justify-center",
    checked ? "bg-emerald-700/80 border-emerald-700" : "border-white/20 hover:border-white/40",
    isLoading && "cursor-wait", className)}>
   {isLoading ? <WreathSpinner className="ledger-purchase-wreath" /> : checked && <svg
    className={cn("ledger-purchase-check text-white", celebrate && "ledger-purchase-check-pop")}
    xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M5 12l5 5l10 -10" />
   </svg>}
  </button>
 </>;
};
