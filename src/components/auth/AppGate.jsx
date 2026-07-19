"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { apiFetch } from "@/lib/client-utils";
import Workspace from "@/components/Workspace";

// Gates /app behind a valid session and hands the signed-in user to the
// workspace so it never has to re-fetch it.
export default function AppGate() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => window.location.replace("/login"));
  }, []);

  if (!user) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-cream">
        <LogoMark size={56} />
        <p className="flex items-center gap-2 text-[13.5px] text-muted">
          <Loader2 size={15} className="animate-spin" /> Opening your workspace…
        </p>
      </main>
    );
  }

  return <Workspace user={user} />;
}
