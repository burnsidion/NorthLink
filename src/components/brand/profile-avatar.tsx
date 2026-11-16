"use client";
import { useState } from "react";

/** A failed image stays local to this rendering; never rewrites a saved choice. */
export function ProfileAvatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
 const [failed, setFailed] = useState<string | null>(null);
 const usable = Boolean(src?.startsWith("https://") && src !== failed);
 return <span className="ledger-avatar" style={{ width: size, height: size }} role={usable ? undefined : "img"} aria-label={usable ? undefined : `${name} avatar unavailable`}>
  {usable ? <img src={src!} alt={`${name} avatar`} width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(src!)} /> : <span aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || "?"}</span>}
 </span>;
}
