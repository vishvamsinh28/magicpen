import AppGate from "@/components/auth/AppGate";

export const metadata = {
  title: "MagicPen — Workspace",
};

export default function AppPage() {
  return <AppGate />;
}
