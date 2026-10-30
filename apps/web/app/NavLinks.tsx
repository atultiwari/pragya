"use client";

import { NavLinksView } from "@/components/nav/NavLinksView";
import { authClient } from "@/lib/auth-client";

/** Session-aware nav links; the session lives on the API host, so this resolves in the browser. */
export function NavLinks() {
  const { data: session, isPending } = authClient.useSession();
  return <NavLinksView signedIn={isPending ? null : session !== null} />;
}
