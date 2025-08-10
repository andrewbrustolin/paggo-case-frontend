"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";

type Props = {
  onSubmit: (data: { email: string; password: string }) => Promise<void>;
  switchToRegister: () => void;
};

type LoginFields = { email: string; password: string };

export default function LoginForm({ onSubmit, switchToRegister }: Props) {
  const [serverErr, setServerErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFields>({ mode: "onBlur" });

  async function submit(data: LoginFields) {
    setServerErr(null);
    try {
      await onSubmit(data);
    } catch (e: any) {
      const msg = e?.message || "Login failed";
      setServerErr(msg);
      setError("password", { type: "server", message: "Invalid email or password" });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4 p-6 bg-white rounded-xl shadow-lg w-full max-w-sm mx-auto">
      <h1 className="text-2xl font-semibold text-center">Sign In</h1>
      {serverErr && <p className="text-sm text-red-600 text-center">{serverErr}</p>}

      <div>
        <input
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mt-2"
          placeholder="Email"
          type="email"
          {...register("email", {
            required: "Email is required",
            pattern: { value: /\S+@\S+\.\S+/, message: "Enter a valid email" },
          })}
        />
        {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <input
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mt-2"
          placeholder="Password"
          type="password"
          {...register("password", {
            required: "Password is required",
            minLength: { value: 6, message: "At least 6 characters" },
          })}
        />
        {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
      </div>

      <button
        disabled={isSubmitting}
        className="w-full bg-indigo-600 text-white rounded-lg py-2 mt-4 hover:bg-indigo-700 disabled:opacity-50"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>

      <button
        type="button"
        onClick={switchToRegister}
        className="w-full text-sm text-center text-gray-600 hover:underline mt-2"
      >
        Create an account
      </button>
    </form>
  );
}
