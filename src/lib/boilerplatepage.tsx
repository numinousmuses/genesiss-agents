/* eslint-disable */
"use client";
import styles from "./workflows.module.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Workflows() {

    const [session, setSession] = useState<{
        userId: string;
        email: string;
        username: string;
        docks?: any;
      } | null>(null);

    const router = useRouter();

    useEffect(() => {
        const fetchSession = async () => {
          try {
            const response = await fetch("/api/auth/session");
            if (response.ok) {
              const data = await response.json();
              setSession(data);
            } else {
              router.push("/login");
            }
          } catch (error) {
            console.error("Error fetching session:", error);
            router.push("/login");
          }
        };

        if (!session) {
          fetchSession();
        }
    
      }, [ router, session]);

    const handleLogout = async () => {
    try {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (response.ok) {
        router.push("/login");
        } else {
        console.error("Logout failed");
        }
    } catch (error) {
        console.error("Logout error:", error);
    }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.logoText}>
                    <a href="/">
                    GENESISS <span className={styles.logospan}>AGENTS</span>
                    </a>
                </div>
                <div className={styles.session}>
                    {session ? (
                        <div className={styles.sessionText}>
                        <p className={styles.username}>Workflows</p>
                        </div>
                    ) : (
                        <p className={styles.sessionText}>Loading...</p>
                    )}
                </div>
                <div className={styles.settings}>
                    <button className={styles.logoutButton}>New Workflow</button>
                    <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
                </div>
            </div>
            <div className={styles.content}></div>
            <div className={styles.footer}></div>
        </div>
    );
}