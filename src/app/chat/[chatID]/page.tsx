/*  eslint-disable */
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "./chat.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { format } from "path";
import * as webllm from "@mlc-ai/web-llm";
import usePythonRunner from '@/lib/withPythonRunner';
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
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

const modelId = "Llama-3.2-3B-Instruct-q4f32_1-MLC"
// const codeModelId = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC"

// Function to check if a string is a UUID
const isEmail = (member: string): boolean => {
  return member.includes('@');
};

// Function to filter out UUIDs from a list of team members and return only emails
const filterMembers = (members: string[]): string[] => {
  return members.filter((member) => isEmail(member));
};

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
  const [viewPermissions, setViewPermissions] = useState<{ [key: string]: boolean }>({});
  const [editPermissions, setEditPermissions] = useState<{ [key: string]: boolean }>({});
  const [canSendMessage, setCanSendMessage] = useState(true);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [filteredAgents, setFilteredAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [codeEngine, setCodeEngine] = useState<webllm.MLCEngineInterface | null>(null);
  const [llamaEngine, setLlamaEngine] = useState<webllm.MLCEngineInterface | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [pythonEngine, setPythonEngine] = useState<any>(null);
  const [useAPI, setUseAPI] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const params = useParams();
  const chatID = params?.chatID;

  // Define the LLM prompting logic
  const promptLLMJSONSchema = async (schema: any, prompt: string, engine: webllm.MLCEngineInterface): Promise<any> => {
      const schemaString = JSON.stringify(schema);
      

      const request: webllm.ChatCompletionRequest = {
          stream: false,
          messages: [
              {
                  role: "user",
                  content: prompt,
              },
          ],
          max_tokens: 8000,
          response_format: {
              type: "json_object",
              schema: schemaString,
          } as webllm.ResponseFormat,
      };

      try {
          console.log("Message about to be sent to chat completion")
          const completion = await engine.chatCompletion(request);
          const output = completion.choices[0]?.message?.content;  // Access the generated content
          console.log("Generated JSON Output:", output);
          return output
          // return JSON.parse(output!); // Parse the JSON response
      } catch (error) {
          console.error("Error generating JSON based on schema:", error);
          try{
              console.log("Trying to generate schema again")
              const completion = await engine.chatCompletion(request);
              const output = completion.choices[0]?.message?.content;  // Access the generated content
              console.log("Generated JSON Output:", output);
              return JSON.parse(output!); // Parse the JSON response
          } catch {
              console.log("Ultimate Fail")
              return null
          }
      }
  };

  // load pyodide
  const { pyodide } = usePythonRunner();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const data = await response.json();
          setSession(data); // Set session here
          const initProgressCallback = (report: webllm.InitProgressReport) => {
              console.log("LLM Initialization:", report.text);
          };
    
          const llamaengine: webllm.MLCEngineInterface = await webllm.CreateMLCEngine(modelId, { initProgressCallback });
          setLlamaEngine(llamaengine);
          // const codeengine: webllm.MLCEngineInterface = await webllm.CreateMLCEngine(codeModelId, { initProgressCallback });
          // setCodeEngine(codeengine);

          if (pyodide && !pythonEngine) {
            setPythonEngine(pyodide);
          }

          
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
  }, [session, router, pyodide, pythonEngine]);


  // This effect runs after `session` is updated
  useEffect(() => {
    const fetchChatsAndTeams = async () => {
      if (!session?.userId) return;

      try {
        const chatResponse = await fetch(`/api/chats/${session.userId}`);
        if (chatResponse.ok) {
          const chatData: Chat[] = await chatResponse.json();

          // if chatID not in chats, redirect to dashboard
          if (!chatData.some((chat: Chat) => chat.chatID === chatID)) {
            router.push("/dashboard");
          }

          
        }
      } catch (error) {
        router.push("/dashboard");
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
      const response = await fetch("/api/chats/retrieve", {
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
      const response = await fetch("/api/chats/rename", {
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

  const handleInternetAgent = async () => {
    try {
        const data = await fetch("/api/chats/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userID: session?.userId,
                chatID: chatID,
            }),
        });

        const { context } = await data.json();
        const LLMPrompt = `You are Genesiss AI. You are a helpful assistant with the ability to search the internet. Given the following context and user message, your job is to generate a list of internet queries to develop a source-based answer. Dependent should be true if you want to make further queries after your first queries are searched an analyzed. This is useful if later queries are dependent on the internet results of previous queries. User prompt: ${newMessage} \nContext: ${context}.\nThe chat messages:, latest to oldest:\n ${JSON.stringify(chat?.messages.reverse())}`;

        const schema = {
            type: "object",
            properties: {
                dependent: { type: "boolean" },
                queries: { type: "array", items: { type: "string" } }
            },
            required: ["dependent", "queries"]
        };

        let generatedQueries = await promptLLMJSONSchema(schema, LLMPrompt, llamaEngine!);
        generatedQueries = JSON.parse(generatedQueries);

        setStatusMessage("Searching the internet...");

        const scrapeResponse = await fetch("/api/internet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                queries: generatedQueries.queries,
            }),
        });

        const scrapeData: string[][] = await scrapeResponse.json();
        setStatusMessage("Reading pages...");

        let totalContext = "";

        for (const contentArray of scrapeData) {
            for (const pageContent of contentArray) {
                const subqueryLLMPrompt = `You are Genesiss AI. You are a helpful assistant. You were given the prompt: ${newMessage}, and made the following internet search: ${generatedQueries.queries[1]}. Given the following context and user message, your job is to generate a source-based answer. Your source is: ${pageContent}. Format your response as a markdown paragraph, properly embedding urls and images.`;

                const subquerySchema = {
                    type: "object",
                    properties: { response: { type: "string" } },
                    required: ["response"]
                };

                let generatedAnswer = await promptLLMJSONSchema(subquerySchema, subqueryLLMPrompt, llamaEngine!);
                generatedAnswer = JSON.parse(generatedAnswer);
                const { response } = generatedAnswer;
                totalContext += response + "\n";
            }
        }

        if (generatedQueries.dependent) {
            const regenPrompt = `You are Genesiss AI. You are a helpful assistant with the ability to search the internet. Given the following context and user message, your job is to generate a list of internet queries to develop a source-based answer. You previously generated queries: \n ${JSON.stringify(generatedQueries.queries)}.\nThese queries had responses: \n ${totalContext}\n User prompt: ${newMessage} \nContext: ${context}.\nThe chat messages:, latest to oldest:\n ${JSON.stringify(chat?.messages.reverse())}`;

            const regenSchema = {
                type: "object",
                properties: { queries: { type: "array", items: { type: "string" } } },
                required: ["queries"]
            };

            let generatedQueries2 = await promptLLMJSONSchema(regenSchema, regenPrompt, llamaEngine!);
            generatedQueries2 = JSON.parse(generatedQueries2);

            const scrapeResponse = await fetch("/api/internet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    queries: generatedQueries2.queries,
                }),
            });

            const scrapeData2: string[][] = await scrapeResponse.json();
            setStatusMessage("Reading pages...");

            let secondContext = "";

            for (const contentArray of scrapeData2) {
                for (const pageContent of contentArray) {
                    const subqueryLLMPrompt = `You are Genesiss AI. You are a helpful assistant. You were given the prompt: ${newMessage}, and made the following internet search: ${generatedQueries2.queries[1]}. Given the following context and user message, your job is to generate a source-based answer. Your source is: ${pageContent}. Format your response as a markdown paragraph, properly embedding urls and images.`;

                    const subquerySchema = {
                        type: "object",
                        properties: { response: { type: "string" } },
                        required: ["response"]
                    };

                    const generatedAnswer = await promptLLMJSONSchema(subquerySchema, subqueryLLMPrompt, llamaEngine!);
                    const { response } = JSON.parse(generatedAnswer);
                    secondContext += response + "\n";
                }
            }

            setStatusMessage("Conducting analysis...");

            const finalLLMPrompt = `You are Genesiss AI. You are a helpful assistant. You were given the prompt: ${newMessage}, and made the following internet search: ${JSON.stringify(generatedQueries.queries)} \n ${JSON.stringify(generatedQueries2.queries)}. Given the following context and user message, your job is to generate a source-based answer. Format your response as a markdown paragraph, properly embedding urls and images. The internet search information is: ${secondContext} \n ${totalContext}.`;

            const finalSchema = {
                type: "object",
                properties: { response: { type: "string" } },
                required: ["response"]
            };

            const generatedAnswer = await promptLLMJSONSchema(finalSchema, finalLLMPrompt, llamaEngine!);
            const { response } = JSON.parse(generatedAnswer);

            await fetch("/api/chats/store", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chatID: chatID,
                    message: newMessage,
                    response: response
                }),
            });

            setNewMessage("");
            fetchChatMessages();
            return;
        }

        setStatusMessage("Conducting analysis...");
        const finalllmprompt = `You are Genesiss AI. You are a helpful assistant. You were given the prompt: ${newMessage}, and made the following internet search: ${JSON.stringify(generatedQueries.queries)} \n The results from the internet search are: ${totalContext}. Given the internet context and user message, your job is to generate a source-based answer. Format your response as a markdown paragraph, properly embedding urls and images.`;

        const finalSchema = {
            type: "object",
            properties: { response: { type: "string" } },
            required: ["response"]
        };

        const generatedAnswer = await promptLLMJSONSchema(finalSchema, finalllmprompt, llamaEngine!);
        const { response } = JSON.parse(generatedAnswer);

        await fetch("/api/chats/store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chatID: chatID,
                message: newMessage,
                response: response
            }),
        });

        setNewMessage("");
        fetchChatMessages();
        return;
    } catch (error) {
        alert("Failed to send message");
    }
};


  const handleCodeAgent = async () => {
    try {
      // get relevant context from /api/chats/memory
      const data = await fetch("/api/chats/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userID: session?.userId,
          chatID: chatID,
        }),
      })

      const { context } = await data.json();
      // generate steps
      const stepsPrompt = `You are Genesiss AI. Your is to generate and run code. Generate a steps where each step is code that is written and executed in pure python. The user's prompt is: ${newMessage}. The previous chats from newest to oldest ${JSON.stringify(chat?.messages.reverse())}`

      const stepsSchema = {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["steps"]
      }

      const generatedAnswer = await promptLLMJSONSchema(stepsSchema, stepsPrompt, llamaEngine!)

      const { steps } = JSON.parse(generatedAnswer);

      // for each step, generate code

      interface RanCode{
        code: string,
        output: string
      }

      let ranCode: RanCode[] = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const codePrompt = `You are Genesiss AI. Your is to generate and run code. The user's prompt is: ${newMessage}. You generated the steps for code to run based on this: ${JSON.stringify(steps)}. The current step is: ${step}. Generate pure python code (no libraries other than the standard library) to complete this step. The previously ran code and output is ${JSON.stringify(ranCode)}`
        const codeSchema = {
          type: "object",
          properties: {
            code: {
              type: "string"
            },
          },
          required: ["code"]
        }      
        let generatedCode = await promptLLMJSONSchema(codeSchema, codePrompt, llamaEngine!)

        generatedCode = JSON.parse(generatedCode)

        if (pythonEngine) {
          try {
            let result = await pythonEngine.runPython(generatedCode.code);

            ranCode.push({
              code: generatedCode.code,
              output: result
            })
          } catch (error) {
            alert("Error running Python code:");
          }

        }

      }

      // concat everything into one string
      const finalres = ranCode.map(ranCode => 
          `## Generated code:\n~~~py\n${ranCode.code}\n~~~\n\n## Output\n${ranCode.output}\n`
      ).join("\n");

      // store in backend api/chats/store

      // store in backend api/chats/store
      const storeResponse = await fetch("/api/chats/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatID: chatID,
          message: newMessage,
          response: finalres
        }),
      })

      setNewMessage(""); // Clear the input field after sending the message
      fetchChatMessages(); // Fetch updated chat messages
      
      return

    } catch (error) {
      alert("Failed to send message");
    }
  }


  const handleGraphAgent = async () => {
    try {
      // use chat history as context
      const llmPrompt =  `You are Genesiss AI. Your is to generate graphs. Generate a chartjs config object based on the user's prompt. The chart or graph will be 800 width and 600 height. The graph should be dark mode, with a dark background. The user's prompt is: ${newMessage}. The previous chats from newest to oldest ${JSON.stringify(chat?.messages.reverse())}`
      // generate config object for graph
      const chartJsConfigSchema = {
        type: "object",
        properties: {
            type: { type: "string" }, // e.g., "bar", "line", "doughnut"
            data: {
                type: "object",
                properties: {
                    labels: {
                        type: "array",
                        items: {
                            oneOf: [
                                { type: "string" },
                                { type: "number" },
                                {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            ]
                        }
                    },
                    datasets: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                label: { type: "string" },
                                data: {
                                    oneOf: [
                                        {
                                            type: "array",
                                            items: {
                                                oneOf: [
                                                    { type: "number" },
                                                    { type: "object", properties: { x: { type: "number" }, y: { type: ["number", "null"] } }, required: ["x", "y"] },
                                                    { type: "object", properties: { x: { type: "string" }, y: { type: ["number", "null"] } }, required: ["x", "y"] }
                                                ]
                                            }
                                        },
                                        {
                                            type: "object",
                                            additionalProperties: { type: "number" } // For { January: 10, February: 20 } format
                                        }
                                    ]
                                },
                                backgroundColor: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                borderColor: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                borderWidth: { type: "number" },
                                hidden: { type: "boolean" }
                            },
                            required: ["data"]
                        }
                    }
                },
                required: ["datasets"]
            },
            options: {
                type: "object",
                properties: {
                    responsive: { type: "boolean" },
                    height: { type: "number" },
                    width: { type: "number" },
                    background: { type: "string" },
                    colors: {
                        type: "array",
                        items: { type: "string" }
                    },
                    parsing: {
                        oneOf: [
                            { type: "boolean" },
                            {
                                type: "object",
                                properties: {
                                    key: { type: "string" },
                                    xAxisKey: { type: "string" },
                                    yAxisKey: { type: "string" }
                                },
                                additionalProperties: true
                            }
                        ]
                    },
                    scales: {
                        type: "object",
                        additionalProperties: { type: "object" }
                    },
                    plugins: {
                        type: "object",
                        additionalProperties: true
                    }
                },
                additionalProperties: true
            }
        },
        required: ["type", "data"],
        additionalProperties: true
      };

      const graphConfigObj = await promptLLMJSONSchema(chartJsConfigSchema, llmPrompt, llamaEngine!)
    
      // store in backend api/chats/store
      const storeResponse = await fetch("/api/chats/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatID: chatID,
          message: newMessage,
          response: graphConfigObj,
          graphgen: true,
        }),
      })

      setNewMessage(""); // Clear the input field after sending the message
      fetchChatMessages(); // Fetch updated chat messages
      
      return

    } catch (error) {
      
    }
  }


  const handleSimpleAgent = async () => {
    try {
      // rag for context from /api/chats/memory
      const data = await fetch("/api/chats/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userID: session?.userId,
          chatID: chatID,
        }),
      })

      const { context } = await data.json();

      const LLMPrompt = `You are Genesiss AI. You are a helpful assistant. Your task is to generate a response to the user's prompt: ${newMessage} \nYou have the following Context: ${context}.\nThe chat messages:, latest to oldest:\n ${JSON.stringify(chat?.messages.reverse())}`

      const resSchema = {
        type: "object",
        properties: {
          response: { type: "string" },
        },
        required: ["response"],
      }
      // generate simple answer

      const response = await promptLLMJSONSchema(resSchema, LLMPrompt, llamaEngine!)
      // store in backend api/chats/store
      const resString = JSON.parse(response).response

      // store in backend api/chats/store
      const storeResponse = await fetch("/api/chats/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatID: chatID,
          message: newMessage,
          response: resString
        }),
      })

      setNewMessage(""); // Clear the input field after sending the message
      fetchChatMessages(); // Fetch updated chat messages
      
      return
    } catch (error) {
      alert("Failed to send message");
    }
  }



  const sendMessage = async () => {
    if (!newMessage.trim()) return;


      if (selectedFiles.length > 0 || useAPI) {
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
          const response = await fetch("/api/chats/new", {
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
      } else if (selectedAgent === "internet") {
        handleInternetAgent();
      } else if (selectedAgent === "code") {
        handleCodeAgent();
      } else if (selectedAgent === "graph") {
        handleGraphAgent();
      } else {
        handleSimpleAgent();
      }
      
  };

  const deleteChat = async () => {
    if (!chatID) return;

    try {
      const response = await fetch("/api/chats/delete", {
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
    <div className={styles.page}>
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
                ) : msg.author === "graphgen" ? (
                  // Chart.js graph rendering for "graphgen" messages
                  (() => {
                    try {
                      const chartConfig = JSON.parse(msg.message); // Parse the Chart.js config JSON
                      return <Chart {...chartConfig} />;
                    } catch (error) {
                      return <p className={styles.error}>Invalid chart configuration</p>;
                    }
                  })()
                ) : ( // add custom graph rendering method
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
    </div>
  );
}
