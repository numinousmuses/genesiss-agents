"use client";

import { useState } from "react";
import styles from './forgotpassword.module.css'; // Use the same styles as signup page
import Link from "next/link";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // State for confirm password
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Check if passwords match
    if (password !== confirmPassword) {
      alert("Passwords do not match. Please try again.");
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email, password: password }),
      });

      if (response.ok) {
        setMessage("Password reset link has been sent to your email.");
      } else {
        const errorData = await response.json();
        console.error("Error:", errorData.message);
        setMessage("Error: " + errorData.message);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Error sending password reset link.");
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
        <h2>Forgot Password</h2>
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
          <label htmlFor="password" className={styles.label}>New Password</label>
          <input
            type="password"
            name="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
          />
          <label htmlFor="confirmPassword" className={styles.label}>Confirm New Password</label>
          <input
            type="password"
            name="confirmPassword"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={styles.input}
            required
          />
        </span>
        <input className={styles.submit} type="submit" value="Send Reset Link" />
        {message && <p className={styles.message}>{message}</p>}
      </form>
    </div>
  );
}