"use client";

import { useEffect, useState } from "react";
import { clearToken, getToken, setToken } from "@/lib/api";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";

type Props = { 
  children: (props: { logout: () => void }) => React.ReactNode;
  onLogin?: () => void;
};

export default function AuthGate({ children, onLogin }: Props) {
  const [token, setTokenState] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setTokenState(getToken()), []);

  async function handleLogin({ email, password }: { email: string; password: string }) {
    setError(null);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Login failed");
      }
      const data = await res.json();
      setToken(data.access_token);
      setTokenState(data.access_token);
      onLogin?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
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
    setError(null);
    try {
      const create = await fetch("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      if (!create.ok) {
        const errorData = await create.json();
        throw new Error(errorData.message || "Registration failed");
      }
      await handleLogin({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  }

  function logout() {
    clearToken();
    setTokenState(null);
    setMode("login");
    setError(null);
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-2xl shadow w-full max-w-sm space-y-4">
          {/* Error message at the top */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
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