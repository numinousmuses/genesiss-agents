"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from './loginpage.module.css';
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission behavior

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        router.push("/dashboard");
      } else {
        const errorData = await response.json();
        console.error("Login error:", errorData.message);
        alert("Error logging in: " + errorData.message);
      }
    } catch (error) {
      console.error("Error logging in:", error);
      alert("Error logging in");
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <Link href="/" passHref>
          <div className={styles.logo}>
            GENESISS<span className={styles.logospan}>AI</span>
          </div>
        </Link>
        <span className={styles['input-span']}>
          <label htmlFor="email" className={styles.label}>Email</label>
          <input
            type="email"
            name="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
          />
        </span>
        <span className={styles['input-span']}>
          <label htmlFor="password" className={styles.label}>Password</label>
          <input
            type="password"
            name="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
          />
        </span>
        <span className={styles.span}><a href="/forgot-password">Forgot password?</a></span>
        <input className={styles.submit} type="submit" value="Log in" />
        <span className={styles.span}>Don&rsquo;t have an account? <a href="/signup">Sign up</a></span>
      </form>
    </div>
  );
}
