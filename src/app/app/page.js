import AppGate from "@/components/auth/AppGate";

export const metadata = {
  title: "MagicPen — Workspace",
};

/**
 * /app — the workspace entry point.
 * Session checking happens client-side in AppGate (which redirects signed-out
 * visitors), so this server component stays static.
 */
export default function AppPage() {
  return <AppGate />;
}
