"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction } from "@/app/(auth)/login/actions";
import type { LoginState } from "@/lib/auth/login-schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { TextField } from "@/components/ui/text-field";

const initialState: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} noValidate className="flex w-full flex-col gap-6 lg:gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {/* Welcome: mobile and desktop frames use different copy. */}
      <div className="flex w-full flex-col gap-3">
        <p className="text-[11px] text-brand-dark">
          <span className="lg:hidden">RESERVATION MANAGEMENT</span>
          <span className="hidden lg:inline">ADMIN PANEL ACCESS</span>
        </p>
        <h1 className="text-[30px] font-bold text-ink lg:text-[36px]">
          <span className="lg:hidden">Welcome back.</span>
          <span className="hidden lg:inline">Sign in to Admin.</span>
        </h1>
        <p className="text-[14px] leading-[1.6] text-muted">
          <span className="lg:hidden">Log in to keep every transfer on track.</span>
        </p>
      </div>

      <div className="flex w-full flex-col gap-5">
        <TextField
          id="username"
          name="username"
          label="Username"
          placeholder="Enter your admin username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.username}
          error={state.fieldErrors?.username}
          trailing={<Icon name="user-round" size={18} />}
          required
        />
        <TextField
          id="password"
          name="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your admin password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="-m-1 rounded p-1 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <Icon name={showPassword ? "eye" : "eye-off"} size={18} />
            </button>
          }
        />
      </div>

      <Checkbox id="remember" name="remember" label="Remember Me" defaultChecked={state.remember} />

      {state.formError ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {state.formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-70"
      >
        <Icon name="arrow-right" size={18} />
        {pending ? "Signing in…" : "Login"}
      </button>

      <Link
        href="/forgot-password"
        className="self-center text-center text-[13px] font-semibold text-brand-dark hover:underline"
      >
        Reset Password
      </Link>
    </form>
  );
}
