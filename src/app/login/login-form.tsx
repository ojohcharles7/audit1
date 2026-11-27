"use client";

import { useActionState, useEffect, useRef } from "react";
import { loginAction, type LoginState } from "@/lib/auth/actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-demo-email]"));
    const handlers = buttons.map((button) => {
      const handler = () => {
        const email = form.elements.namedItem("identifier");
        const password = form.elements.namedItem("password");
        if (email instanceof HTMLInputElement) email.value = button.dataset.demoEmail ?? "";
        if (password instanceof HTMLInputElement) password.value = button.dataset.demoPassword ?? "";
        if (email instanceof HTMLInputElement) email.focus();
      };
      button.addEventListener("click", handler);
      return () => button.removeEventListener("click", handler);
    });
    return () => handlers.forEach((off) => off());
  }, []);

  return (
    <form ref={formRef} action={formAction} className="mt-6 space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label htmlFor="identifier" className="label">
          Email or username
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          required
          placeholder="head.audit@crunchiesfood.com"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="code" className="label">
          Authenticator code <span className="font-normal text-slate-400">(if enabled)</span>
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="input tracking-[0.3em]"
        />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Signing in…" : "Sign in securely"}
      </button>
    </form>
  );
}
