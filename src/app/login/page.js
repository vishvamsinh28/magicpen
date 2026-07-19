import AuthPage from "@/components/auth/AuthPage";

export const metadata = {
  title: "Sign in — SuperDocs",
};

export default function LoginPage() {
  return <AuthPage mode="login" />;
}
