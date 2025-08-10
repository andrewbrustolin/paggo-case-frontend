"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";

type Props = {
  onSubmit: (data: { email: string; username: string; password: string }) => Promise<void>;
  switchToLogin: () => void;
};

type RegisterFields = {
  email: string;
  username: string;
  password: string;
  confirm: string;
};

export default function RegisterForm({ onSubmit, switchToLogin }: Props) {
  const [serverErr, setServerErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<RegisterFields>({ mode: "onBlur" });

  const passwordValue = watch("password");

  async function submit({ email, username, password, confirm }: RegisterFields) {
    setServerErr(null);

    if (password !== confirm) {
      setError("confirm", { type: "validate", message: "Passwords do not match" });
      return;
    }

    try {
      await onSubmit({ email, username, password });
      reset(); // clear fields on success
    } catch (e: any) {
      const msg = e?.message || "Registration failed";
      setServerErr(msg);
      if (/email/i.test(msg)) setError("email", { type: "server", message: msg });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4 p-6 bg-white rounded-xl shadow-lg w-full max-w-sm mx-auto">
      <h1 className="text-2xl font-semibold text-center">Create Account</h1>
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
          placeholder="Username"
          {...register("username", {
            required: "Username is required",
            minLength: { value: 3, message: "At least 3 characters" },
            maxLength: { value: 32, message: "Up to 32 characters" },
          })}
        />
        {errors.username && <p className="text-xs text-red-600 mt-1">{errors.username.message}</p>}
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

      <div>
        <input
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mt-2"
          placeholder="Confirm Password"
          type="password"
          {...register("confirm", {
            required: "Please confirm your password",
            validate: (val) => val === passwordValue || "Passwords do not match",
          })}
        />
        {errors.confirm && <p className="text-xs text-red-600 mt-1">{errors.confirm.message}</p>}
      </div>

      <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white rounded-lg py-2 mt-4 hover:bg-indigo-700 disabled:opacity-50">
        {isSubmitting ? "Creating…" : "Create Account"}
      </button>

      <button
        type="button"
        onClick={switchToLogin}
        className="w-full text-sm text-center text-gray-600 hover:underline mt-2"
      >
        Have an account? Sign in
      </button>
    </form>
  );
}
