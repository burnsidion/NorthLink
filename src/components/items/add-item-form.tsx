"use client";

import ItemThumbnail from "@/components/items/item-thumbnail";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useProductAutofill } from "@/lib/use-product-autofill";

type Props = {
 imageUrl: string | null;
 setImageUrl: Dispatch<SetStateAction<string | null>>;
 open: boolean;
 onOpenChange: (next: boolean) => void;
 title: string;
 setTitle: Dispatch<SetStateAction<string>>;
 price: string;
 setPrice: Dispatch<SetStateAction<string>>;
 link: string;
 setLink: (value: string) => void;
 notes: string;
 setNotes: (value: string) => void;
 onSubmit: (event: FormEvent) => void;
 submitting?: boolean;
};

export default function AddItemForm(props: Props) {
 const { open, onOpenChange, title, setTitle, price, setPrice, link, setLink,
  notes, setNotes, onSubmit, submitting, imageUrl, setImageUrl } = props;
 const autofill = useProductAutofill(props);
 if (!open) return <div className="pt-2"><button type="button" onClick={() => { autofill.cancel(); onOpenChange(true); }}
  aria-expanded={open} aria-controls="add-item-form" className="ledger-button">Add item</button></div>;

 return <form id="add-item-form" onSubmit={event => { autofill.cancel(); onSubmit(event); }} className="ledger-add-form">
  <div className="ledger-product-lookup">
   <label htmlFor="gift-product-link">Shop link <span className="ledger-muted">(optional)</span></label>
   <p id="gift-lookup-help" className="ledger-muted">Paste a product link to fill in details, or enter everything manually below.</p>
   <div className="ledger-product-lookup-actions">
    <input id="gift-product-link" disabled={submitting} name="link" aria-label="Shop link"
     aria-describedby="gift-lookup-help" placeholder="Link (amazon.com/…)" value={link}
     onChange={event => { autofill.cancel(); setImageUrl(null); setLink(event.target.value); }} className="ledger-input" />
    <button type="button" disabled={submitting || autofill.loading || !link.trim()}
     onClick={() => void autofill.fill()} className="ledger-secondary">{autofill.loading ? "Looking up…" : "Fill from link"}</button>
    {autofill.loading && <button type="button" onClick={autofill.cancel} className="ledger-text-button">Stop lookup</button>}
   </div>
   {autofill.loading && <p role="status" className="ledger-muted">Looking for product details. You can keep editing.</p>}
   {autofill.feedback && <p role={autofill.feedback.kind === "error" ? "alert" : "status"}
    className={autofill.feedback.kind === "error" ? "ledger-error" : "ledger-muted"}>{autofill.feedback.message}</p>}
  </div>
  {imageUrl && <div className="ledger-thumbnail-preview"><ItemThumbnail src={imageUrl} /><span>Suggested thumbnail</span>
   <button type="button" disabled={submitting} className="ledger-text-button" onClick={() => { autofill.markEdited("image"); setImageUrl(null); }}>Remove image</button></div>}
  <label className="ledger-gift-name-field">Gift name
   <input disabled={submitting} required name="title" aria-label="Gift name" placeholder="Item name"
    maxLength={120} value={title} onChange={event => { autofill.markEdited("title"); setTitle(event.target.value); }} className="ledger-input" />
  </label>
  <div className="ledger-form-fields">
   <label>Price <span className="ledger-muted">(optional)</span>
    <input disabled={submitting} name="price" aria-label="Price" aria-describedby="gift-price-note"
     inputMode="decimal" placeholder="Price (e.g. 24.99)" value={price}
     onChange={event => { autofill.markEdited("price"); setPrice(event.target.value); }} className="ledger-input" />
    <span id="gift-price-note" className="ledger-price-note">Prices may change. Check the retailer for the current price.</span>
   </label>
   <label>Notes <span className="ledger-muted">(optional)</span>
    <input disabled={submitting} name="notes" aria-label="Notes" placeholder="Size, color, or other preferences"
     value={notes} onChange={event => setNotes(event.target.value)} className="ledger-input" />
   </label>
  </div>
  <div className="ledger-inline-actions">
   <button type="submit" disabled={!!submitting} className="ledger-button">{submitting ? "Saving…" : "Save"}</button>
   <button type="button" disabled={submitting} onClick={() => { autofill.cancel(); onOpenChange(false); }} className="ledger-secondary">Cancel</button>
  </div>
 </form>;
}
