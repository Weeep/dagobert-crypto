"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DFrame from "../components/DFrame";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorEpoch, setErrorEpoch] = useState<number>(0);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/");
    } else {
      const data = await res.json();
      setErrorMessage(data.error);
      setErrorEpoch(new Date().getTime());
    }
  };

  return (
    <DFrame
      errorMessage={errorMessage}
      errorEpoch={errorEpoch}
      className="flex justify-center items-center w-screen h-screen"
    >
      <div>
        <h1 className="text-center text-4xl p-2">Welcome</h1>
        <form
          className="flex flex-col text-center gap-3"
          onSubmit={handleSubmit}
        >
          <div>
            <label>Email: </label>
            <input
              className="w-48 text-black"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Password: </label>
            <input
              className="w-48 text-black"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue active:bg-blue-800"
            type="submit"
          >
            Login
          </button>
        </form>
      </div>
    </DFrame>
  );
}
