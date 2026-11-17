import { WreathLoader } from "@/components/ui/wreath-loader";

export default function Loading() {
 return <main className="ledger-theme ledger-paper ledger-page" aria-busy="true">
  <WreathLoader label="Loading page…" className="ledger-empty" />
 </main>;
}
