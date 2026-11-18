"use client";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { dismissTour, quickTourSteps, tourWasDismissed } from "@/lib/quick-tour";

/** Small schematic previews avoid requiring a populated family or example gifts. */
function TourIllustration({ step }: { step: number }) {
 return <svg className="ledger-tour-illustration" viewBox="0 0 260 112" fill="none" aria-hidden="true" focusable="false">
  <rect x="10" y="8" width="240" height="96" rx="8" fill="#fff8e8" stroke="#bda079" />
  <path d="M24 29h212" stroke="#cfb58d" />
  <circle cx="25" cy="19" r="3" fill="#913d36" /><path d="M35 19h45" stroke="#bda079" strokeWidth="3" strokeLinecap="round" />
  {step === 1 ? <>
   <circle cx="92" cy="53" r="8" fill="#58735b" /><circle cx="130" cy="48" r="10" fill="#214c3b" /><circle cx="168" cy="53" r="8" fill="#58735b" />
   <path d="M77 76c0-18 30-18 30 0m5 0c0-23 36-23 36 0m5 0c0-18 30-18 30 0" stroke="#214c3b" strokeWidth="4" strokeLinecap="round" />
   <rect x="101" y="85" width="58" height="9" rx="4" fill="#e4cfaa" />
  </> : step === 2 ? <>
   {[43,64,85].map(y => <g key={y}><rect x="27" y={y} width="206" height="13" rx="6" fill="#eeddbb" stroke="#bda079" /><path d={`M42 ${y+6}h75`} stroke="#886a48" strokeWidth="2" strokeLinecap="round" /><rect x="185" y={y+3} width="33" height="7" rx="3" fill="#214c3b" /></g>)}
  </> : step === 3 ? <>
   <rect x="27" y="41" width="154" height="15" rx="3" stroke="#bda079" /><path d="M37 48h105" stroke="#bda079" strokeWidth="2" />
   <rect x="188" y="41" width="45" height="15" rx="3" fill="#214c3b" />
   <rect x="27" y="66" width="29" height="27" rx="3" fill="#e4cfaa" /><path d="M67 71h150m-150 11h70m12 0h68m-150 10h105" stroke="#bda079" strokeWidth="3" strokeLinecap="round" />
  </> : step === 4 ? <>
   {[29,137].map(x => <g key={x}><path d={`M${x} 43q45 8 92 0v47q-45-8-92 0Z`} fill="#eeddbb" stroke="#bda079" /><path d={`M${x+46} 47v36`} stroke="#913d36" strokeWidth="2" /><path d={`M${x+9} 61h26m-26 13h22`} stroke="#886a48" strokeWidth="2" strokeLinecap="round" /></g>)}
  </> : <>
   {[47,76].map((y,i) => <g key={y}><rect x="29" y={y} width="15" height="15" rx="3" fill={i ? '#fff8e8' : '#214c3b'} stroke="#214c3b" />{!i && <path d="m32 54 3 3 6-7" stroke="#fff8e8" strokeWidth="2" />}<path d={`M57 ${y+7}h115m18 0h38`} stroke="#bda079" strokeWidth="3" strokeLinecap="round" /></g>)}
  </>}
 </svg>;
}

/** Mounted only after the dashboard has loaded a signed-in, complete profile. */
export default function QuickTour({ userId, onOpenChange }: { userId: string; onOpenChange?: (open: boolean) => void }) {
 const [open, setOpen] = useState(() => !tourWasDismissed(userId));
 const [step, setStep] = useState(0);
 const dialog = useRef<HTMLDivElement>(null);
 const replay = useRef<HTMLButtonElement>(null);
 const title = useRef<HTMLHeadingElement>(null);
 const wasOpen = useRef(open);
 useDialogFocus(open, dialog);
 useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
 useEffect(() => {
  if (wasOpen.current && !open) replay.current?.focus();
  wasOpen.current = open;
 }, [open]);
 useEffect(() => {
  if (open && step > 0) {
   title.current?.focus();
   if (dialog.current) dialog.current.scrollTop = 0;
  }
 }, [open, step]);
 useEffect(() => {
  if (!open) return;
  const previous = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => { document.body.style.overflow = previous; };
 }, [open]);
 const close = () => {
  dismissTour(userId); setOpen(false);
 };
 const current = step ? quickTourSteps[step - 1] : null;
 return <>
  <button type="button" ref={replay} className="ledger-secondary" onClick={() => { onOpenChange?.(true); setStep(0); setOpen(true); }}>Quick tour</button>
  {open && <div className="ledger-theme ledger-dialog-backdrop ledger-tour-backdrop" role="dialog" aria-modal="true"
   aria-labelledby="quick-tour-title" aria-describedby="quick-tour-description" ref={dialog} tabIndex={-1}
   onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
   <div className="ledger-paper ledger-dialog ledger-tour-dialog">
    <p className="ledger-eyebrow">{step ? `Step ${step} of ${quickTourSteps.length}` : "Getting started"}</p>
    <div>
     <h2 id="quick-tour-title" ref={title} tabIndex={-1}>{current?.title ?? "Welcome to CyberSanta"}</h2>
     {current ? <div className="ledger-tour-preview"><TourIllustration step={step} /><p className="ledger-tour-location"><span>Where to find it</span><strong>{current.section}</strong></p></div>
      : <div className="ledger-tour-welcome-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M10 21h28v8H10zM13 29v13h22V29M24 21v21M24 21C8 21 10 7 17 10c5 2 7 11 7 11Zm0 0c16 0 14-14 7-11-5 2-7 11-7 11Z" stroke="currentColor" strokeWidth="2" /></svg></div>}
     {step > 0 && <ol className="ledger-tour-progress" aria-label="Tour progress">{quickTourSteps.map((item, index) => <li key={item.title} aria-current={index + 1 === step ? "step" : undefined} data-complete={index + 1 < step}><span className="sr-only">Step {index + 1}: {item.title}</span></li>)}</ol>}
     <p id="quick-tour-description">{current?.text ?? "Learn how to create a family group, share lists, add items and mark purchases in five short steps. You can skip the tour and reopen it using Quick tour on Home."}</p>
    </div>
    <div className="ledger-inline-actions ledger-tour-actions">
     {step > 0 && <button type="button" className="ledger-secondary" onClick={() => setStep(value => value - 1)}>Back</button>}
     <button type="button" className="ledger-button" onClick={() => step === quickTourSteps.length ? close() : setStep(value => value + 1)}>{step === 0 ? "Take a quick tour" : step === quickTourSteps.length ? "Finish tour" : "Next"}</button>
     <button type="button" className="ledger-text-button" onClick={close}>{step === 0 ? "Skip for now" : "Skip tour"}</button>
    </div>
   </div>
  </div>}
 </>;
}
