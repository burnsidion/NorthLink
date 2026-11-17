import { cn } from "@/lib/utils";

/** Decorative spinner; its containing status supplies the accessible message. */
export function WreathSpinner({ className }: { className?: string }) {
 return <svg className={cn("ledger-wreath-spinner", className)} width="32" height="32" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
  <circle cx="24" cy="24" r="15" stroke="#3c6a45" strokeWidth="5" />
  {Array.from({length:12}, (_, index) => <g key={index} transform={`rotate(${index * 30} 24 24)`}>
   <ellipse cx="21" cy="9" rx="3" ry="5" transform="rotate(-35 21 9)" fill={index % 2 ? "#6b9156" : "#315d3e"} />
   <ellipse cx="27" cy="9" rx="3" ry="5" transform="rotate(35 27 9)" fill={index % 2 ? "#315d3e" : "#6b9156"} />
  </g>)}
  {[60,180,300].map(angle => <g key={angle} transform={`rotate(${angle} 24 24)`}><circle cx="23" cy="9" r="2.5" fill="#c63d3b" /><circle cx="27" cy="11" r="2" fill="#a5282b" /></g>)}
  <path d="M24 8c-8-8-14 4-2 3l-5 7 4 1 3-8 3 8 4-1-5-7c12 1 6-11-2-3Z" fill="#b63135" stroke="#fff4dc" strokeWidth=".8" />
 </svg>;
}

export function WreathLoader({ label = "Loading…", className }: { label?: string; className?: string }) {
 return <div role="status" className={cn("ledger-wreath-status", className)}><WreathSpinner /><span>{label}</span></div>;
}
