import AuthPage from "@/components/auth/AuthPage";

export const metadata = {
  title: "Sign in — MagicPen",
};

/**
 * /login — sign-in screen.
 * Thin wrapper: AuthPage renders both auth screens and the mode prop picks
 * the sign-in variant.
 */
export default function LoginPage() {
  return <AuthPage mode="login" />;
}
