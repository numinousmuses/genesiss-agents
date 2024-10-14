/*  eslint-disable */
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "./canvas.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { format } from "path";
import EditorJS from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import CodeTool from "@editorjs/code";
import InlineCode from "@editorjs/inline-code";
import Marker from "@editorjs/marker";
import Embed from "@editorjs/embed";
import Table from "@editorjs/table";
import LinkTool from "@editorjs/link";
import ImageTool from "@editorjs/image";

interface Message {
  message: string;
  author: string;
  files?: any[]; // Add files for messages that include uploads
}

interface ChatResponse {
  chatTitle: string;
  brainID?: string;
  messages: Message[];
}

interface Chat {
  chatID: string,
  chatTitle: string,
  teamTitle?: string,
  messages?: Message[],
}

const agents = ["internet", "codegen", "graphgen", "imagegen", "docucomp", "memstore", "memsearch", "simplechat"];


export default function Chat() {
  const [session, setSession] = useState<{
    userId: string;
    email: string;
    username: string;
    docks?: any;
  } | null>(null);
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [author, setAuthor] = useState("user"); // Default author is "user"
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); // For settings modal
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // For file uploads
  const [newChatTitle, setNewChatTitle] = useState(""); // For renaming chat
  const [canSendMessage, setCanSendMessage] = useState(true);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [filteredAgents, setFilteredAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [ isChatOpen, setIsChatOpen ] = useState(true);
  const [ isCanvasOpen, setIsCanvasOpen ] = useState(true);
  const editorRef = useRef<EditorJS | null>(null); // EditorJS ref

  const router = useRouter();
  const params = useParams();
  const chatID = params?.chatID;

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const data = await response.json();
          setSession(data); // Set session here
        } else {
          router.push("/login");
        }
      } catch (error) {
        console.error("Error fetching session:", error);
        router.push("/login");
      }
    };

    if (!session) {
      fetchSession(); // Fetch the session
    }
  }, [session, router]);

  // Initialize Editor.js with error handling
  useEffect(() => {
    if (!editorRef.current) {
      editorRef.current = new EditorJS({
        holder: "editorjs",
        tools: {
          header: Header,
          list: List,
          code: CodeTool,
          inlineCode: InlineCode,
        },

        placeholder: "Start typing your notes...",
        minHeight: 0,
      });
    }

    return () => {
      if (editorRef.current && typeof editorRef.current.destroy === "function") {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);


  // This effect runs after `session` is updated
  useEffect(() => {
    const fetchChatsAndTeams = async () => {
      if (!session?.userId) return;

      try {
        const chatResponse = await fetch(`/api/canvaschat/${session.userId}`);
        if (chatResponse.ok) {
          const chatData: Chat[] = await chatResponse.json();

          console.log("Chat data:", chatData);

          //if chatID not in chats, redirect to dashboard
          if (!chatData.some((chat: Chat) => chat.chatID === chatID)) {
            router.push("/dashboard");
          }

          
        }
      } catch (error) {
        console.log("Error fetching chats or teams:", error);
        
        console.error("Error fetching chats or teams:", error);
      }
    };

    if (session) {
      fetchChatsAndTeams(); // Fetch chats and teams after session is set
    }
  }, [session, chatID, router]);


  const fetchChatMessages = async () => {
    if (!session?.userId) return;
  
    try {
      const response = await fetch("/api/canvaschat/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userID: session?.userId, chatID: chatID, email: session?.email }),
      });
  
      if (response.ok) {
        const data: ChatResponse = await response.json();

        console.log("Data:", data);

  
        // Set the filtered data in state
        setChat(data);

      
      } else {
        console.error("Failed to retrieve chat");
      }
    } catch (error) {
      console.error("Error retrieving chat:", error);
    }
  };

  useEffect(() => {
    if (session?.userId && !chat) {
      fetchChatMessages();
    }
  }, [chatID, session]);

  // Ref to keep track of the bottom of the chat body
  const bottomRef = useRef<HTMLDivElement | null>(null); 

  const renameChat = async () => {
    if (!newChatTitle.trim()) return;

    try {
      const response = await fetch("/api/canvaschat/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatID: chatID,
          newChatTitle: newChatTitle,
        }),
      });

      if (response.ok) {
        fetchChatMessages();
        setNewChatTitle(""); // Clear input after renaming
        setIsSettingsModalOpen(false); // Close modal after renaming
      } else {
        console.error("Failed to rename chat");
      }
    } catch (error) {
      console.error("Error renaming chat:", error);
    }
  };

  const handleAgentMention = (text: string) => {
    const match = text.match(/@(\w*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      setFilteredAgents(agents.filter((agent) => agent.startsWith(query)));
      setIsAgentMenuOpen(true);
    } else {
      setIsAgentMenuOpen(false);
    }
  };

  const handleAgentSelect = (agent: string) => {
    setSelectedAgent(agent);
    setNewMessage(`@${agent} `);
    setIsAgentMenuOpen(false);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    handleAgentMention(value);
    // if ((value.match(/@/g) || []).length <= 1) {
      
    // } else {
    //   alert("Only one @mention is allowed per message.");
    // }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const validFiles = validateFiles(selectedFiles);
    if (!validFiles) return;

    const formData = new FormData();
    formData.append("chatID", String(chatID || ""));
    formData.append(
      "userMessage",
      JSON.stringify({
        message: newMessage,
        author: author,
      })
    );
    if (selectedAgent) formData.append("agent", selectedAgent);

    selectedFiles.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/canvaschat/new", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setNewMessage(""); // Clear the input field after sending the message
        setSelectedFiles([]); // Clear file selection
        fetchChatMessages(); // Fetch updated chat messages
      } else {
        console.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const deleteChat = async () => {
    if (!chatID) return;

    try {
      const response = await fetch("/api/canvaschat/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatID }),
      });

      if (response.ok) {
        router.push("/dashboard");
      } else {
        console.error("Failed to delete chat");
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = validateFiles(files);
    if (validFiles) {
      setSelectedFiles(files);
    }
  };

  const validateFiles = (files: File[]) => {
    const imageFormats = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    const documentFormats = [
      "application/pdf",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/html",
      "text/plain",
      "text/markdown",
    ];

    const maxImageSize = 3.75 * 1024 * 1024; // 3.75 MB
    const maxDocumentSize = 4.5 * 1024 * 1024; // 4.5 MB

    let imageCount = 0;
    let documentCount = 0;

    for (let file of files) {
      const fileType = file.type;

      if (imageFormats.includes(fileType)) {
        imageCount++;
        if (imageCount > 20) {
          alert("You can only upload up to 20 images.");
          return false;
        }
        if (file.size > maxImageSize) {
          alert("Each image must be smaller than 3.75 MB.");
          return false;
        }

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          if (img.width > 8000 || img.height > 8000) {
            alert(
              "Each image's dimensions must be less than or equal to 8000px."
            );
            return false;
          }
        };
      } else if (documentFormats.includes(fileType)) {
        documentCount++;
        if (documentCount > 5) {
          alert("You can only upload up to 5 documents.");
          return false;
        }
        if (file.size > maxDocumentSize) {
          alert("Each document must be smaller than 4.5 MB.");
          return false;
        }
      } else {
        alert(
          `Unsupported file format: ${file.name}. Accepted formats: images (${imageFormats.join(
            " | "
          )}), documents (${documentFormats.join(" | ")}).`
        );
        return false;
      }
    }

    return true;
  };

  const openSettingsModal = () => setIsSettingsModalOpen(true);
  const closeSettingsModal = () => setIsSettingsModalOpen(false);

  return (
    <div className={styles.container}>
    {isChatOpen && <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.backButton} onClick={() => router.push("/dashboard")}>
          Back
        </div>
        <div className={styles.pageTitle}>
          {chat ? chat.chatTitle : "Loading..."}
        </div>
        <div className={styles.settings} onClick={openSettingsModal}>
          Settings
        </div>
      </div>

      <div className={styles.pageBody}>
        {chat ? (
          chat.messages.length > 0 ? (
            chat.messages.map((msg, index) => (
              <div
                key={index}
                className={
                  msg.author === "user" ? styles.userMessage : styles.systemMessage
                }
              >
                {msg.author === "user" ? (
                  <span>{msg.message}</span>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    className={styles.markdown}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={nightOwl}
                            PreTag="div"
                            language={match[1]}
                            {...props}
                            className={styles.codeRender}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.message}
                  </ReactMarkdown>
                )}
              </div>
            ))
          ) : (
            <p className={styles.noMessages} >No messages yet. Start the conversation!</p>
          )
        ) : (
          <p className={styles.loading}>Loading chat...</p>
        )}
        <div ref={bottomRef} />
      </div>

      



      {canSendMessage && (
        <div className={styles.pageFooter}>
          
          <div className={styles.inputContainer}>
            
            <input
              type="file"
              id="file-upload"
              multiple
              hidden
              accept=".png,.jpeg,.gif,.webp,.pdf,.csv,.doc,.docx,.xls,.xlsx,.html,.txt,.md"
              className={styles.uploadButton}
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className={styles.customFileUpload}>⏏</label>
            <input
              type="text"
              className={styles.messageInput}
              placeholder="Type your message... Tip: use the @ symbol to select an agent"
              value={newMessage}
              onChange={handleMessageChange}
              onKeyPress={(e) => { if (e.key === "Enter") sendMessage(); }}
            />
            <button onClick={sendMessage} className={styles.sendButton}>Send</button>
          </div>

          {isAgentMenuOpen && (
            <div className={styles.agentMenu}>
              {filteredAgents.map((agent) => (
                <div
                  key={agent}
                  className={styles.agentMenuItem}
                  onClick={() => handleAgentSelect(agent)}
                >
                  {agent}
                </div>
              ))}
            </div>
          )}

          {selectedAgent && !isAgentMenuOpen && (
            <div className={styles.selectedAgentDisplay}>
              Selected Agent: <span className={styles.selectedAgent}>{selectedAgent}</span>
            </div>
          )}

        </div>
      )}

      {isSettingsModalOpen && (
        <div className={styles.modalOverlay} onClick={closeSettingsModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            <div className={styles.modalContent}>
              <label>
                Rename Chat:
                <br />
                <br />
                <input
                  type="text"
                  placeholder="Enter new chat name"
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                  className={styles.input}
                />
              </label>
              <button onClick={renameChat} className={styles.actionButton}>
                Rename Chat
              </button>

              <button onClick={deleteChat} className={styles.deleteButton}>
                Delete Chat
              </button>

              <button onClick={closeSettingsModal} className={styles.closeButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
     
    </div>}
     {isCanvasOpen && <div className={styles.canvas}>
      <button className={styles.toggleButton} onClick={() => setIsChatOpen(!isChatOpen)}>Toggle Chat</button>
      <button className={styles.switchButton} onClick={() => setIsCanvasOpen(!isCanvasOpen)}>Switch to Chat</button>
      <div className={styles.canvasContainer}>
      <div id="editorjs" className={styles.editorContainer}></div>
      </div>
     </div>}
     </div>
  );
}
