import AuthPage from "@/components/auth/AuthPage";

export const metadata = {
  title: "Create account — MagicPen",
};

/**
 * /register — account-creation screen.
 * Thin wrapper: AuthPage renders both auth screens and the mode prop picks
 * the registration variant.
 */
export default function RegisterPage() {
  return <AuthPage mode="register" />;
}
