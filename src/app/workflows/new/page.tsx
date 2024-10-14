/* eslint-disable */
"use client";
import styles from "./new.module.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs"; // For date handling

export default function Workflows() {

    const [session, setSession] = useState<{
        userId: string;
        email: string;
        username: string;
        docks?: any;
      } | null>(null);

    const [boxes, setBoxes] = useState<{ id: string; position: { row: number; col: number }, agent?: string, prompt?: string, brainID?: string }[]>([
        { id: "box-0", position: { row: 0, col: 0 } }
    ]);

    const [isPopupOpen, setIsPopupOpen] = useState(true);
    const [currentBoxId, setCurrentBoxId] = useState<string | null>("box-0");
    const [selectedAgent, setSelectedAgent] = useState<string>("internet");
    const [prompt, setPrompt] = useState<string>("");
    const [brainID, setBrainID] = useState<string>("");

    const [isSubmitPopupOpen, setIsSubmitPopupOpen] = useState(false);
    const [workflowTitle, setWorkflowTitle] = useState("");
    const [workflowDescription, setWorkflowDescription] = useState("");
    const [frequency, setFrequency] = useState("daily");
    const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [startTime, setStartTime] = useState(dayjs().format("HH:00"));
    const [endDate, setEndDate] = useState("");
    const [dayOfWeek, setDayOfWeek] = useState("1"); // 1 = Sunday
    const [dayOfMonth, setDayOfMonth] = useState("1");

    const router = useRouter();

    interface WorkflowOutput {
        runDate: string;
        output: string;
        status: string;
        creditsConsumed: number;
    }

    interface Workflow {
        title: string;
        description: string;
        frequency: string;
        createdAt: string;
        outputs: WorkflowOutput[];
    }

    interface WorkflowAgentArray {
        agentID: string;
        inputs: string | string[];
    }

    interface WorkflowConfiguration {
        title: string;
        description: string;
        frequency: string;
        createdAt: string;
        agents: WorkflowAgentArray[][];
    }

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

    const addBox = (position: { row: number; col: number }) => {
        const newBox = {
            id: `box-${boxes.length}`,
            position,
        };
        setBoxes((prevBoxes) => [...prevBoxes, newBox]);
        return newBox.id;
    };

    const handleAddRight = (box: { id: string; position: { row: number; col: number } }) => {
        const newBoxId = addBox({ row: box.position.row, col: box.position.col + 1 });
        openPopup(newBoxId);
    };

    const handleAddBottom = (box: { id: string; position: { row: number; col: number } }) => {
        const newBoxId = addBox({ row: box.position.row + 1, col: box.position.col });
        openPopup(newBoxId);
    };

    const openPopup = (boxId: string) => {
        setCurrentBoxId(boxId);
        setIsPopupOpen(true);
        setSelectedAgent("internet");
        setPrompt("");
        setBrainID(""); // Reset brainID when a new box is created or edited
    };

    const handlePopupSubmit = () => {
        setBoxes((prevBoxes) =>
            prevBoxes.map((box) =>
                box.id === currentBoxId ? { ...box, agent: selectedAgent, prompt, brainID } : box
            )
        );
        setIsPopupOpen(false);
        setPrompt("");
        setBrainID("");
    };

    const handleEditBox = (boxId: string) => {
        const box = boxes.find(b => b.id === boxId);
        if (box) {
            setSelectedAgent(box.agent || "internet");
            setPrompt(box.prompt || "");
            setBrainID(box.brainID || "");
            openPopup(boxId);
        }
    };

    const handleDeleteBox = () => {
        setBoxes((prevBoxes) => prevBoxes.filter(box => box.id !== currentBoxId));
        setIsPopupOpen(false);
    };

    const generateCronString = () => {
        const [hour, minute] = startTime.split(":");
        switch (frequency) {
            case "hourly":
                return `cron(${minute} * * * ? *)`;
            case "daily":
                return `cron(${minute} ${hour} * * ? *)`;
            case "weekly":
                return `cron(${minute} ${hour} ? * ${dayOfWeek} *)`;
            case "monthly":
                return `cron(${minute} ${hour} ${dayOfMonth} * ? *)`;
            case "specificDate":
                const day = dayjs(startDate).date();
                const month = dayjs(startDate).month() + 1;
                const year = dayjs(startDate).year();
                return `cron(${minute} ${hour} ${day} ${month} ? ${year})`;
            default:
                return `cron(${minute} ${hour} * * ? *)`;
        }
    };

    const handleSubmitWorkflow = async () => {
        // Check for required fields
        if (!workflowTitle) {
            alert("Workflow title is required.");
            return;
        }
        if (!workflowDescription) {
            alert("Workflow description is required.");
            return;
        }
        if (!frequency) {
            alert("Frequency is required.");
            return;
        }

        // Check if all boxes have an agent and prompt set
        for (const box of boxes) {
            if (!box.agent) {
                alert(`You are missing an agent selection.`);
                return;
            }
            if (!box.prompt) {
                alert(`One of your agents is missing a prompt.`);
                return;
            }
            if ((box.agent === "memstore" || box.agent === "memsearch") && !box.brainID) {
                alert("You need to enter a brainID for the memstore or memsearch agents.");
                return;
            }
        }

        // Proceed with configuration if all checks pass
        const maxRow = Math.max(...boxes.map(box => box.position.row));
        const maxCol = Math.max(...boxes.map(box => box.position.col));
    
        const agentsArray: WorkflowAgentArray[][] = Array.from({ length: maxRow + 1 }, () =>
            Array(maxCol + 1).fill(null)
        );
    
        boxes.forEach(box => {
            if (box.agent && box.prompt) {
                agentsArray[box.position.row][box.position.col] = {
                    agentID: box.agent,
                    inputs: (box.agent === "memstore" || box.agent === "memsearch") && box.brainID 
                        ? [box.brainID, box.prompt] 
                        : box.prompt
                };
            }
        });
    
        const cleanedAgentsArray = agentsArray.map(row => row.filter(cell => cell !== null));
    
        const workflowConfig: WorkflowConfiguration = {
            title: workflowTitle,
            description: workflowDescription,
            frequency: generateCronString(),
            createdAt: new Date().toISOString(),
            agents: cleanedAgentsArray
        };

        try {
            const response = await fetch("/api/workflows/new", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({userID: session?.userId, workflowConfig: workflowConfig})
            });

            if (response.ok) {
                setIsSubmitPopupOpen(false);
                alert("Workflow created successfully!");
                router.push("/workflows");
            } else {
                alert("Failed to submit workflow.");
            }
        } catch (error) {
            console.error("Error submitting workflow:", error);
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
                        <p className={styles.username}>Create New Workflow</p>
                        </div>
                    ) : (
                        <p className={styles.sessionText}>Loading...</p>
                    )}
                </div>
                <div className={styles.settings}>
                    <button onClick={() => setIsSubmitPopupOpen(true)} className={styles.submitButton}>Submit</button>

                    <button onClick={() => router.push("/dashboard")} className={styles.settingsButton}>Dashboard</button>    

                    <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
                </div>
            </div>
            
            <div className={styles.content}>
                <div className={styles.workflowContainer}>
                    {boxes.map((box) => (
                        <div 
                            key={box.id} 
                            className={styles.box} 
                            style={{ gridRow: box.position.row + 1, gridColumn: box.position.col + 1 }}
                            onClick={() => handleEditBox(box.id)}
                        >
                            <strong>{box.agent ? `${box.agent} agent` : "ALERT: Configure or Delete This Agent"}</strong>
                            {box.prompt && <p>{box.prompt.length > 15 ? `${box.prompt.slice(0, 20)}...` : box.prompt}</p>}
                            <button onClick={(e) => { e.stopPropagation(); handleAddRight(box); }} className={styles.addButton}>+</button>
                            {box.position.col === 0 && (
                                <button onClick={(e) => { e.stopPropagation(); handleAddBottom(box); }} className={styles.addButton}>+</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {isPopupOpen && (
                <div className={styles.popup}>
                    <div className={styles.popupContent}>
                        <h2>{currentBoxId ? "Edit Agent" : "Create Agent"}</h2>
                        <label>
                            Agent:
                            <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
                                <option value="internet">Internet</option>
                                <option value="codegen">Codegen</option>
                                <option value="graphgen">Graphgen</option>
                                <option value="imagegen">Imagegen</option>
                                <option value="docugen">Docugen</option>
                                <option value="memstore">Memstore</option>
                                <option value="memsearch">Memsearch</option>
                                <option value="simplechat">Simplechat</option>
                                <option value="presentgen">Presentgen</option>
                            </select>
                        </label>
                        {["memstore", "memsearch"].includes(selectedAgent) && (
                            <label>
                                Brain ID:
                                <input type="text" value={brainID} onChange={(e) => setBrainID(e.target.value)} />
                            </label>
                        )}
                        <label>
                            Prompt:
                            <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                        </label>
                        <div className={styles.buttonsFooter}>
                            <button onClick={handlePopupSubmit}>Save</button>
                            <button onClick={handleDeleteBox}>Delete</button>
                            <button onClick={() => setIsPopupOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {isSubmitPopupOpen && (
                <div className={styles.popup}>
                    <div className={styles.popupContent}>
                        <h2>Submit Workflow</h2>
                        <label>
                            Title:
                            <input type="text" value={workflowTitle} onChange={(e) => setWorkflowTitle(e.target.value)} />
                        </label>
                        <label>
                            Description:
                            <input type="text" value={workflowDescription} onChange={(e) => setWorkflowDescription(e.target.value)} />
                        </label>
                        <label>
                            Frequency:
                            <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                                <option value="hourly">Hourly</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="specificDate">Specific Date</option>
                            </select>
                        </label>
                        {frequency === "weekly" && (
                            <label>
                                Day of Week:
                                <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
                                    <option value="1">Sunday</option>
                                    <option value="2">Monday</option>
                                    <option value="3">Tuesday</option>
                                    <option value="4">Wednesday</option>
                                    <option value="5">Thursday</option>
                                    <option value="6">Friday</option>
                                    <option value="7">Saturday</option>
                                </select>
                            </label>
                        )}
                        {frequency === "monthly" && (
                            <label>
                                Day of Month:
                                <input type="number" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} min="1" max="31" />
                            </label>
                        )}
                        {frequency === "specificDate" && (
                            <label>
                                Specific Date:
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </label>
                        )}
                        <label>
                            Start Time:
                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </label>
                        <div className={styles.buttonsFooter}>
                        <button onClick={handleSubmitWorkflow}>Send</button>
                        <button onClick={() => setIsSubmitPopupOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.footer}></div>
        </div>
    );
}
