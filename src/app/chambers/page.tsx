/* eslint-disable */

// create chamber:
// select number of agents
// for each agent, provide a system prompt
// initial prompt
// no brainids
// choose timer: 5s, 10s, 15s, 30s, 60s, 120s
// choose first agent to respond out of the user-inputted agents
// post to backend, redirect

interface ChamberConfig {
    userId: string;
    chamberTitle: string;
    initialPrompt: string;
    agents: AgentConfig[];
    timer: number;
    firstAgent: string;
    unlimited: boolean;
}

interface AgentConfig {
    name: string;
    systemPrompt: string;
}

"use client";
import styles from "./chambers.module.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Chat {
  chatID: string;
  chatTitle: string;
  messages?: Message[];
}

interface Message {
  author: string;
  message: string;
}

// retrieved chats are Chat[], and then chats are separated based on team (Removed team separation)

export default function Dashboard() {
  const [session, setSession] = useState<{
    userId: string;
    email: string;
    username: string;
    docks?: any;
  } | null>(null);

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedBrainID, setSelectedBrainID] = useState('');
  const [newBrainID, setNewBrainID] = useState('');
  const [brainIDs, setBrainIDs] = useState<string[]>([]); // List of brainIDs
  const [viewPermissions, setViewPermissions] = useState<{ [key: string]: boolean }>({});
  const [editPermissions, setEditPermissions] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCreateChatModalOpen, setIsCreateChatModalOpen] = useState(false);
  const [isCreateCanvasChatModalOpen, setIsCreateCanvasChatModalOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [hasError, setHasError] = useState(false); 

  // Function to check if a string is an email
  const isEmail = (member: string): boolean => {
    return member.includes('@');
  };

  // Function to filter out non-email members
  const filterMembers = (members: string[]): string[] => {
    return members.filter((member) => isEmail(member));
  };

  const refreshPage = () => {
    window.location.reload(); // Use any of the methods above here
  };

  // Define the word to animate, could be any word
  const word = "GENESISS";
  const letters = ['G', 'E', 'N', 'E', 'S', 'I', 'S', 'S', ' AGENTS']; // Split word into individual letters

  // State to control which letters are visible
  const [visibleLetters, setVisibleLetters] = useState<number[]>([]);
  const [animationPhase, setAnimationPhase] = useState("fadeIn");

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

    const fetchChats = async () => {
      // Prevent fetch if there's an error or session is not yet set
      if (!session?.userId || hasError) return;

      try {
        // Fetch chats for the user
        const chatResponse = await fetch(`/api/chambers/${session.userId}`);
        if (chatResponse.ok) {
          const chatData: Chat[] = await chatResponse.json();
          setChats(chatData);
        } else {
          setHasError(true);
        }
      } catch (error) {
        setHasError(true);
        console.error("Error fetching chats:", error);
      }
    };

    if (!session) {
      fetchSession();
    }

    // Only call fetchChats when session is available and no errors have occurred
    if (session && !hasError) {
      fetchChats();
    }

  }, [animationPhase, router, session, hasError]);

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

  // Organize chats without team separation
  const organizedChats = () => {
    return chats.map((chat) => (
      <div className={styles.chatcontainer} key={chat.chatID}>
      <div
        key={chat.chatID}
        className={styles.chatBox}
        onClick={() => router.push(`/canvaschat/${chat.chatID}`)}
      >
        {chat.chatTitle}
      </div>
      <div className={styles.chatID}>{chat.chatID}</div>
    </div>
    ));
  };

  // Function to handle username change
  const changeUsername = async () => {
    const confirmChange = window.confirm(
      "Are you sure you want to change your username?"
    );

    if (confirmChange) {
      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: session?.userId,
            action: "changeUsername",
            oldEmail: session?.email,
            newUsername,
          }),
        });
        if (response.ok) {
          alert("Username changed successfully");
          // update session username
          setSession((prevSession) => {
            if (prevSession) {
              return { ...prevSession, username: newUsername };
            }
            return prevSession;
          });
        } else {
          console.error("Failed to change username");
        }
      } catch (error) {
        console.error("Error changing username:", error);
      }
    }
  };

  // Function to handle email change
  const changeEmail = async () => {
    const confirmChange = window.confirm(
      "Are you sure you want to change your email?"
    );

    if (confirmChange) {
      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: session?.userId,
            action: "changeEmail",
            oldEmail: session?.email,
            newEmail,
          }),
        });
        if (response.ok) {
          alert("Email change initiated. Please check your email for verification.");
          handleLogout(); // Log out the user after email change
        } else {
          console.error("Failed to change email");
        }
      } catch (error) {
        console.error("Error changing email:", error);
      }
    }
  };

  // Functions to handle opening/closing modals
  const openCreateChatModal = () => setIsCreateChatModalOpen(true);
  const closeCreateChatModal = () => setIsCreateChatModalOpen(false);

  const openCreateCanvasChatModal = () => setIsCreateCanvasChatModalOpen(true);
  const closeCreateCanvasChatModal = () => setIsCreateCanvasChatModalOpen(false);

  // Fetch brainIDs when opening the modal
  useEffect(() => {
    const fetchBrainIDs = async () => {
      if (!session?.userId) return;

      try {
        const response = await fetch(`/api/brainID/${session.userId}`);
        if (response.ok) {
          const data = await response.json();
          console.log("Brain IDs:", data);
          setBrainIDs(data);
        } else {
          console.error("Failed to fetch brain IDs");
        }
      } catch (error) {
        console.error("Error fetching brain IDs:", error);
      }
    };

    if (isCreateChatModalOpen) {
      fetchBrainIDs();
    }
  }, [isCreateChatModalOpen, session?.userId]);

  interface CreateChatRequest {
    userId: string; // The ID of the user creating the chat
    chatTitle: string; // The title of the new chat
    brainID?: string; // The brain ID associated with the chat (can be selected or created new)
  }

  // Function to handle chat creation
  const createChat = async () => {
    if (!newChatTitle.trim()) {
      alert("Please enter a chat title.");
      return;
    }

    try {
      const params: CreateChatRequest = {
        userId: session?.userId || '',
        chatTitle: newChatTitle,
        brainID: selectedBrainID === "createNew" ? newBrainID : selectedBrainID,
      };

      const response = await fetch("/api/chambers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const { chatID } = await response.json();
        router.push(`/chambers/${chatID}`);
        closeCreateChatModal();
      } else {
        alert("Failed to create chat");
      }
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  const createCanvasChat = async () => {
    if (!newChatTitle.trim()) {
      alert("Please enter a chat title.");
      return;
    }

    try {
      const params: CreateChatRequest = {
        userId: session?.userId || '',
        chatTitle: newChatTitle,
        brainID: selectedBrainID === "createNew" ? newBrainID : selectedBrainID,
      };

      const response = await fetch("/api/chambers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const { chatID } = await response.json();
        router.push(`/chambers/${chatID}`);
        closeCreateChatModal();
      } else {
        alert("Failed to create chat");
      }
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  const openSettingsModal = () => setIsSettingsModalOpen(true); // Open Settings modal
  const closeSettingsModal = () => setIsSettingsModalOpen(false); // Close Settings modal


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
              <p className={styles.username}>Hello, {session.username}!</p>
            </div>
          ) : (
            <p className={styles.sessionText}>Loading...</p>
          )}
        </div>
        <div className={styles.settings}>
          <button onClick={openCreateCanvasChatModal} className={styles.createCanvasChatButton}>Chamber</button>
          <button className={styles.logoutButton} onClick={() => router.push('/dashboard')}>Dashboard</button>
          <button className={styles.settingsButton} onClick={openSettingsModal}>
            Settings
          </button>
          <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
        </div>
      </div>
      <div className={styles.content}>
        {organizedChats()}
        {chats.length === 0 && 
          <div className={styles.noChats}>
            <p>You have no chambers yet. Create one now!</p>
            <button onClick={openCreateCanvasChatModal} className={styles.createChatButton}>Create Chamber</button>
          </div>
        }
      </div>

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className={styles.modalOverlay} onClick={closeSettingsModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            <div className={styles.modalContent}>
              <label>
                <input
                  type="text"
                  placeholder="Enter new username"
                  className={styles.input}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <button onClick={changeUsername} className={styles.actionButton}>
                  Change Username
                </button>
              </label>
              <label>
                <input
                  type="email"
                  placeholder="Enter new email"
                  className={styles.input}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <button onClick={changeEmail} className={styles.actionButton}>
                  Change Email
                </button>
              </label>
              Forgot your password?
              <button onClick={() => router.push("/forgot-password")} className={styles.actionButton}>
                Reset Password
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button onClick={closeSettingsModal} className={styles.closeButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateCanvasChatModalOpen && (
              <div className={styles.chatModalOverlay} onClick={closeCreateCanvasChatModal}>
                <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                  <h2>Create a New Chamber</h2>
                  <div className={`${styles.createChatSection} ${styles.modalContent}`}>
                    <label>
                      Chamber Title:
                      <input
                        type="text"
                        placeholder="Enter chat title"
                        value={newChatTitle}
                        onChange={(e) => setNewChatTitle(e.target.value)}
                        className={styles.input}
                      />
                    </label>

                    <label>
                      Select Brain:
                      <select
                        value={selectedBrainID}
                        onChange={(e) => setSelectedBrainID(e.target.value)}
                        className={styles.input}
                      >
                        {brainIDs.length > 0 ? (
                          brainIDs.map((brainID) => (
                            <option key={brainID} value={brainID}>
                              {brainID}
                            </option>
                          ))
                        ) : (
                          <option value="">No Custom Brain (Default)</option>
                        )}
                        <option value="createNew">Create New Brain ID</option>
                      </select>
                    </label>

                    {selectedBrainID === "createNew" && (
                      <label>
                        New Brain ID:
                        <input
                          type="text"
                          placeholder="Enter new brain ID"
                          value={newBrainID}
                          onChange={(e) => setNewBrainID(e.target.value)}
                          className={styles.input}
                        />
                      </label>
                    )}

                    <button onClick={createCanvasChat} className={styles.actionButton}>
                      Create Chamber
                    </button>
                  </div>
                  <div className={styles.modalFooter}>
                    <button onClick={closeCreateCanvasChatModal} className={styles.closeButton}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

    </div>
  );
}
