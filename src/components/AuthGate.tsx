"use client";

import { useEffect, useState } from "react";
import { clearToken, getToken, setToken } from "@/lib/api";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";

type Props = { 
  children: (props: { logout: () => void }) => React.ReactNode;
};

export default function AuthGate({ children }: Props) {
  const [token, setTokenState] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => setTokenState(getToken()), []);

  async function handleLogin({ email, password }: { email: string; password: string }) {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setToken(data.access_token);
    setTokenState(data.access_token);
  }

  async function handleRegister({
    email,
    username,
    password,
  }: {
    email: string;
    username: string;
    password: string;
  }) {
    const create = await fetch("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    if (!create.ok) throw new Error(await create.text());
    await handleLogin({ email, password });
  }

  function logout() {
    clearToken();
    setTokenState(null);
    setMode("login");
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-2xl shadow w-full max-w-sm space-y-4">
          {mode === "login" ? (
            <LoginForm onSubmit={handleLogin} switchToRegister={() => setMode("register")} />
          ) : (
            <RegisterForm onSubmit={handleRegister} switchToLogin={() => setMode("login")} />
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {children({ logout })}
    </div>
  );
}
