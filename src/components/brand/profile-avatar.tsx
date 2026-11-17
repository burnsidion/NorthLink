"use client";
import { useState } from "react";

// Match the opaque canvas in the original GIFs; transparent sprites use the shared neutral fill.
const animatedAvatarRoot = "https://uvbutyqndjjrtvvmifoi.supabase.co/storage/v1/object/public/animated-avatars/";
const animatedBackgrounds: Readonly<Record<string, string>> = {
 "goku.gif": "#ffffff", "SS3.gif": "#ffffff", "SS4.gif": "#ffffff", "SSW.gif": "#ffffff",
 "snorlax.gif": "#ffffff",
 "injured.gif": "#486870", "jumping-kirby.gif": "#486870", "kirby-inhale.gif": "#486870",
 "kirby-run.gif": "#486870", "looking-kirb.gif": "#486870",
 "finn-sword.gif": "#00ff50", "Marceline_Bass.gif": "#00ff50", "dancing-finn.gif": "#00ff50",
 "marcie-brella.gif": "#00ff50", "nose-pick.gif": "#00ff50", "pocket-jake.gif": "#00ff50", "reading.gif": "#00ff50",
 "walking.gif": "#008080",
};

/** A failed image stays local to this rendering; never rewrites a saved choice. */
export function ProfileAvatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
 const [failed, setFailed] = useState<string | null>(null);
 const usable = Boolean(src?.startsWith("https://") && src !== failed);
 const backgroundColor = usable && src?.startsWith(animatedAvatarRoot)
  ? animatedBackgrounds[src.slice(animatedAvatarRoot.length)] : undefined;
 return <span className="ledger-avatar" style={{ width: size, height: size, backgroundColor }} role={usable ? undefined : "img"} aria-label={usable ? undefined : `${name} avatar unavailable`}>
  {usable ? <img src={src!} alt={`${name} avatar`} width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(src!)} /> : <span aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || "?"}</span>}
 </span>;
}
