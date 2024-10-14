"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import styles from './signuppage.module.css';
import Link from "next/link";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // Add username state
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await axios.post("/api/auth/signup", { email, password, username }); // Include username
      alert("Signup successful! Please check your email to verify your account.");
      router.push("/login");
    } catch (error) {
      console.error("Error signing up:", error);
      alert("Error signing up");
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
          <label htmlFor="username" className={styles.label}>Username</label>
          <input
            type="text" // Correct the input type
            name="username"
            id="username"
            value={username} // Set value to username state
            onChange={(e) => setUsername(e.target.value)} // Update username state
            className={styles.input}
            required
          />
        </span>
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
        
        <input className={styles.submit} type="submit" value="Sign Up" />
        <span className={styles.span}>Already have an account? <a href="/login">Login</a></span>
      </form>
    </div>
  );
}
