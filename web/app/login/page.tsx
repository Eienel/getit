import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <article className="max-w-lg mx-auto">
      <p className="smallcaps text-xs text-ink-faded text-center">Subscribers' entrance</p>
      <h2 className="font-display text-3xl sm:text-4xl mt-2 text-center">Sign in</h2>
      <hr className="my-6" />
      <Suspense fallback={<p className="text-center text-ink-faded">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </article>
  );
}
