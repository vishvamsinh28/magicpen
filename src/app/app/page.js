import AppGate from "@/components/auth/AppGate";

export const metadata = {
  title: "SuperDocs — Workspace",
};

export default function AppPage() {
  return <AppGate />;
}
