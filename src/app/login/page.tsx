"use client";
//Deps
import { useEffect, useRef, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase, initialAuthUrl } from "@/lib/supabase";
import { finishAuthCallback, isPasswordRecoveryUrl } from "@/lib/auth-flow";
import { getProfileUser } from "@/lib/auth-helpers";
import { CyberSantaBrand } from "@/components/brand/cybersanta-brand";

export default function LoginPage() {
  const sb = supabase;

  const generation = useRef(0);
  const completedSignIn = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [failedAttempt, setFailedAttempt] = useState<number | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") completedSignIn.current = true;
      if (event === "SIGNED_OUT") completedSignIn.current = false;
      if (
        [
          "INITIAL_SESSION",
          "SIGNED_IN",
          "SIGNED_OUT",
          "TOKEN_REFRESHED",
          "PASSWORD_RECOVERY",
        ].includes(event)
      ) {
        generation.current++;
        setAttempt((value) => value + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    let active = true;
    const request = ++generation.current;
    // Let a signed-in user request a fresh link after a failed recovery attempt.
    if (new URL(window.location.href).searchParams.has("reset") && !completedSignIn.current) return () => { active = false; };
    if (isPasswordRecoveryUrl(initialAuthUrl)) {
      finishAuthCallback(initialAuthUrl!).then(destination => {
        if (active && generation.current === request) window.location.replace(destination);
      }).catch(() => {
        if (active && generation.current === request) window.location.replace('/reset-password?error=link');
      });
      return () => { active = false; };
    }
    // Validate stored sessions before redirecting. An expired/revoked session
    // must leave the sign-in form available rather than bouncing to the gate.
    getProfileUser()
      .then((user) => {
        if (active && generation.current === request && user)
          window.location.replace("/");
      })
      .catch(() => {
        if (active && generation.current === request) setFailedAttempt(attempt);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <main className="ledger-frame ledger-theme ledger-auth-shell">
      <div className="ledger-paper ledger-auth-card">
        <CyberSantaBrand />
        <h1>Welcome to CyberSanta</h1>
        <p className="ledger-muted">
          Sign in to gather wishes and keep surprises secret.
        </p>
        {failedAttempt === attempt && (
          <div className="mb-4 space-y-2">
            <p role="alert">
              We couldn’t check your sign-in. Please try again.
            </p>
            <button
              onClick={() => setAttempt((value) => value + 1)}
              className="underline"
            >
              Try again
            </button>
          </div>
        )}
        <Auth
          supabaseClient={sb}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "#193f30",
                  brandAccent: "#24563f",
                  brandButtonText: "#fff8e8",
                  inputBackground: "#fff9e9",
                  inputBorder: "#bda47d",
                  anchorTextColor: "#193f30",
                  messageText: "#842d29",
                  inputText: "#39271e",
                  inputLabelText: "#6c5542",
                  inputPlaceholder: "#6c5542",
                },
              },
            },
          }}
          providers={[]}
          view="sign_in"
          redirectTo={
            typeof window !== "undefined"
              ? `${window.location.origin}/api/auth/callback`
              : undefined
          }
        />
      </div>
    </main>
  );
}
