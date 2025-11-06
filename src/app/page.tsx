"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function GateSpinner() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <svg className="size-4 animate-spin" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span>Checking your session…</span>
      </div>
    </div>
  );
}

export default function HomeGate() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) throw sessionErr;

        if (!session) {
          if (!cancelled) router.replace("/login");
          return;
        }

        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profErr) throw profErr;

        const incomplete = !profile || !profile.display_name || !profile.avatar_url;
        if (!cancelled) router.replace(incomplete ? "/onboarding" : "/landing");
      } catch (err: any) {
        toast.error(err?.message ?? "Something went wrong checking your session.");
        if (!cancelled) router.replace("/login");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (booting) return <GateSpinner />;
  return null;
}
