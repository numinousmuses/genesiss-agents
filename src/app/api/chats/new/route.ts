import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import * as stream from "stream";

// Initialize the S3 client
const s3Client = new S3Client({ region: "us-east-1" });

interface Message {
  message: string;
  author: string;
}

interface ChatObject {
  messages: Message[];
}

interface ChatRequest {
  ak: string; // API key
  message: string;
  internet: boolean;
  format: 'json' | 'markdown' | 'text';
  chatID?: string;
  brainID?: string[]; // Optional memory IDs (additional brains)
  images?: string[]; // Optional array of base64-encoded images
  documents?: string[]; // Optional array of base64-encoded documents
}

interface ChatResponse {
  chatID: string;
  message: string;
}

// Helper function to retrieve a string from an S3 object
const streamToString = (stream: stream.Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });

// Helper function to retrieve the chat object from S3
const getChatFromS3 = async (chatID: string): Promise<ChatObject | null> => {
  try {
    const command = new GetObjectCommand({
      Bucket: Resource.GenesissAgentsBucket.name, // Your S3 bucket name
      Key: chatID, // The chatID is used as the key
    });

    const response = await s3Client.send(command);
    if (response.Body instanceof stream.Readable) {
      const data = await streamToString(response.Body);
      return JSON.parse(data) as ChatObject;
    } else {
      throw new Error("Unexpected response body type from S3");
    }
  } catch (error) {
    console.error("Error retrieving chat from S3:", error);
    return null;
  }
};

// Helper function to upload the updated chat object back to S3
const uploadChatToS3 = async (chatID: string, updatedChat: ChatObject): Promise<void> => {
  try {
    const command = new PutObjectCommand({
      Bucket: Resource.GenesissAgentsBucket.name, // Your S3 bucket name
      Key: chatID,
      Body: JSON.stringify(updatedChat),
      ContentType: "application/json",
    });
    await s3Client.send(command);
  } catch (error) {
    console.error("Error uploading chat to S3:", error);
    throw new Error("Error uploading chat to S3");
  }
};

// Helper function to read files and convert them to Base64
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

// Helper function to call the external chat API
const sendMessageToChatAPI = async (
  message: string,
  chatID: string,
  brainID?: string[],
  base64Images?: string[],
  base64Documents?: string[]
): Promise<ChatResponse> => {
  try {
    const apiUrl = "https://genesiss.tech/api/chat";
    const apiKey = Resource.GenesissAgentsAPIKey.value; // Replace with the actual API key

    const chatRequest: ChatRequest = {
      ak: apiKey,
      message: message,
      internet: true, // Arbitrary input, you can change this based on your needs
      format: 'markdown',
      chatID: chatID,
      brainID: brainID,
      images: base64Images,
      documents: base64Documents,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatRequest),
    });

    if (!response.ok) {
      throw new Error("Error sending message to chat API");
    }

    const finalResponse = await response.json() as ChatResponse;
    return finalResponse;
  } catch (error) {
    console.error("Error calling the external chat API:", error);
    throw new Error("Failed to send message to external chat API");
  }
};

export async function POST(request: NextRequest) {
  try {
    // Parse the request body to get chatID, userMessage, files, and other data
    const formData = await request.formData();
    const chatID = formData.get('chatID') as string;
    const userMessage = JSON.parse(formData.get('userMessage') as string) as Message;
    const files = formData.getAll('files') as File[]; // Get all file inputs
    let brainID = chatID;
    const teamID = formData.get('teamID') as string | undefined;

    const agents = formData.get('agents') as string | undefined;

    if (!chatID || !userMessage || !userMessage.message || !userMessage.author) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }
    
    const agentoptions = ["internet", "codegen", "graphgen", "imagegen", "docucomp", "memstore", "memsearch", "simplechat"];



    if (agents) {
      switch (agents) {
        case 'internet':
          break
        case 'codegen':
          try {// call the codegen API
          interface CodeRequest {
            ak: string;
            prompt: string;
          }

          interface SmartCodeExecResponse{
              ranCode: RanCode[],
              conclusion: string
          }
          
          interface RanCode {
              code: string,
              stdout: string
          }

          const codeRequest: CodeRequest = {
            ak: Resource.GenesissAgentsAPIKey.value,
            prompt: userMessage.message
          };

          const codeResponse = await fetch('https://genesiss.tech/api/code', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(codeRequest),
          });

          if (!codeResponse.ok) {
            throw new Error("Error sending message to chat API");
          }

          const codeResponseJson = await codeResponse.json() as SmartCodeExecResponse;

          // iterate through the ranCode array and create a markdown string with the code response, formatting the code ran and the stdout

          const codeResponseString = codeResponseJson.ranCode.map((ranCode) => {
            return `### Ran Code\n\n\`\`\`\n${ranCode.code}\n\`\`\n\n### Output\n\n\`\`\`\n${ranCode.stdout}\n\`\`\`\n`;
          })

          const codeResponseMarkdown = "## Results from Code Agent:\n\n" + codeResponseString.join("\n\n");
          // create a new message object with the code response

          const newMessage: Message = {
            message: codeResponseMarkdown,
            author: 'Code Agent',
          }
          // add the response to the messages array (chatObject)

          // Step 1: Retrieve the existing chat object from S3
          let chatObject = await getChatFromS3(chatID);

          if (!chatObject) {
            chatObject = { messages: [userMessage] };
          } else {
            // Step 2: Append the new message to the existing chat object
            chatObject.messages.push(userMessage);

            chatObject.messages.push(newMessage);

            // Step 3: Save the updated chat object to S3
            await uploadChatToS3(chatID, chatObject);

            // return success
            return NextResponse.json({ message: "Message sent successfully" }, { status: 200 });
          }

          } catch (error) {
            console.error("Error sending message to chat API:", error);
            return NextResponse.json({ message: "Error sending message" }, { status: 500 });
          }

          // return success
        case 'graphgen':
          interface GraphGenRequest {
            ak: string;
            prompt: string;
          }

          const graphGenRequest: GraphGenRequest = {
            ak: Resource.GenesissAgentsAPIKey.value,
            prompt: userMessage.message
          };

          try {
            const graphGenResponse = await fetch('https://genesiss.tech/api/graphgen', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(graphGenRequest),
            })

            if (!graphGenResponse.ok) {
              throw new Error("Error sending message to chat API");
            }

            const { graphURL } = await graphGenResponse.json() as {graphURL: string};

            const graphMarkdown = "## Generated Graph:\n\n" + "![Generated Graph]("+graphURL+")\n\n";

            const newMessage: Message = {
              message: graphMarkdown,
              author: 'Graph Agent',
            }

            // Step 1: Retrieve the existing chat object from S3
            let chatObject = await getChatFromS3(chatID);

            if (!chatObject) {
              chatObject = { messages: [userMessage] };
            } else {
              // Step 2: Append the new message to the existing chat object
              chatObject.messages.push(userMessage);

              chatObject.messages.push(newMessage);

              // Step 3: Save the updated chat object to S3
              await uploadChatToS3(chatID, chatObject);

              // return success
              return NextResponse.json({ message: "Message sent successfully" }, { status: 200 });
            }

          } catch (error) {
            console.error("GraphGen Error:", error);
            return NextResponse.json({ message: "Error sending message" }, { status: 500 });
          }
          
          
        case 'imagegen':
          try {
            const imageGenResponse = await fetch('https://genesiss.tech/api/imagegen', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ak: Resource.GenesissAgentsAPIKey.value,
                prompt: userMessage.message
              }),
            })

            if (!imageGenResponse.ok) {
              throw new Error("Error sending message to chat API");
            }

            const { imageURL } = await imageGenResponse.json() as {imageURL: string};

            const imageMarkdown = "## Generated Image:\n\n" + "![Generated Image]("+imageURL+")\n\n";

            const newMessage: Message = {
              message: imageMarkdown,
              author: 'Image Agent',
            }

            // Step 1: Retrieve the existing chat object from S3
            let chatObject = await getChatFromS3(chatID);

            if (!chatObject) {
              chatObject = { messages: [userMessage] };
            } else {
              // Step 2: Append the new message to the existing chat object
              chatObject.messages.push(userMessage);

              chatObject.messages.push(newMessage);

              // Step 3: Save the updated chat object to S3
              await uploadChatToS3(chatID, chatObject);

              // return success
              return NextResponse.json({ message: "Message sent successfully" }, { status: 200 });
            }
            
          } catch (error) {
            console.error("ImageGen Error:", error);
            return NextResponse.json({ message: "Error sending message" }, { status: 500 });
          }
        case 'docucomp':
          try {
            const docuCompResponse = await fetch('https://genesiss.tech/api/docucomp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ak: Resource.GenesissAgentsAPIKey.value,
                prompt: userMessage.message
              }),
            })

            if (!docuCompResponse.ok) {
              
              throw new Error("Error sending message to chat API");
            }

            const { documentURL } = await docuCompResponse.json() as {documentURL: string};

            const documentMarkdown = "## Document agent generated:\n\n" + "[Generated Document]("+documentURL+")\n\n";

            const newMessage: Message = {
              message: documentMarkdown,
              author: 'Document Agent',
            }

            // Step 1: Retrieve the existing chat object from S3
            let chatObject = await getChatFromS3(chatID);

            if (!chatObject) {
              chatObject = { messages: [userMessage] };
            } else {
              // Step 2: Append the new message to the existing chat object
              chatObject.messages.push(userMessage);

              chatObject.messages.push(newMessage);

              // Step 3: Save the updated chat object to S3
              await uploadChatToS3(chatID, chatObject);

              // return success
              return NextResponse.json({ message: "Message sent successfully" }, { status: 200 });
            }

          } catch (error) {
            console.error("DocuComp Error:", error);
            return NextResponse.json({ message: "Error sending message" }, { status: 500 });
          }
        case 'memstore':
          try {
            const memStoreResponse = await fetch('https://genesiss.tech/api/memory', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ak: Resource.GenesissAgentsAPIKey.value,
                brainID: brainID,
                task: 'add',
                content: userMessage.message
              }),
            })

            if (!memStoreResponse.ok) {
              
              throw new Error("Error sending message to chat API");
            }

            const newMessage: Message = {
              message: "Successfully added to memory",
              author: 'Memory Agent',
            }

            // Step 1: Retrieve the existing chat object from S3
            let chatObject = await getChatFromS3(chatID);

            if (!chatObject) {
              
              chatObject = { messages: [userMessage] };
            } else {
              // Step 2: Append the new message to the existing chat object
              chatObject.messages.push(userMessage);
              
              chatObject.messages.push(newMessage);

              // Step 3: Save the updated chat object to S3
              await uploadChatToS3(chatID, chatObject);

              // return success
              return NextResponse.json({ message: "Message sent successfully" }, { status: 200 });
            
            }
          } catch (error) {
            console.error("MemStore Error:", error);
            return NextResponse.json({ message: "Error sending message" }, { status: 500 });
          }
        case 'memsearch':
          try {
            const memSearchResponse = await fetch('https://genesiss.tech/api/memory', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ak: Resource.GenesissAgentsAPIKey.value,
                brainID: brainID,
                task: 'query',
                content: userMessage.message
              }),
            })

            interface QueryResult {
              metadata: {
                  brainID: string;
                  content: string;
                  [key: string]: any;
              };
              score: number;
            }

            const { results } = await memSearchResponse.json() as {results: QueryResult[][]};
            
            // iterate through queryresult and create markwodn with the content and score
            let resultsMarkdown = "# Results from memory search: \n\n";
            for (const result of results) {
              for (const res of result) {
              resultsMarkdown += `## Search Result: \n\n ${res.metadata.content}`;
            }}

            if (!memSearchResponse.ok) {
              
              throw new Error("Error sending message to chat API");
            }

            const newMessage: Message = {
              message: resultsMarkdown,
              author: 'Memory Agent',
            }

            // Step 1: Retrieve the existing chat object from S3
            let chatObject = await getChatFromS3(chatID);

            if (!chatObject) {
              chatObject = { messages: [userMessage] };
            } else {
              // Step 2: Append the new message to the existing chat object
              chatObject.messages.push(userMessage);
              
              chatObject.messages.push(newMessage);

              // Step 3: Save the updated chat object to S3

              await uploadChatToS3(chatID, chatObject);

              // return success
              return NextResponse.json({ message: "Message sent successfully" }, { status: 200 });
            }
          } catch (error) {
            console.error("MemSearch Error:", error);
            return NextResponse.json({ message: "Error sending message" }, { status: 500 });
          }
        case 'simplechat':
          const simpleChatResponse = await fetch('https://genesiss.tech/api/schat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ak: Resource.GenesissAgentsAPIKey.value,
              prompt: userMessage.message
            }),
          })

          if (!simpleChatResponse.ok) {
            
            throw new Error("Error sending message to chat API");
          }

          const { response } = await simpleChatResponse.json();

          const newMessage: Message = {
            message: response,
            author: 'Simple Chat Agent',
          }

          // Step 1: Retrieve the existing chat object from S3
          let chatObject = await getChatFromS3(chatID);

          if (!chatObject) {
            chatObject = { messages: [userMessage] };
          } else {
            // Step 2: Append the new message to the existing chat object
            chatObject.messages.push(userMessage);
            
            chatObject.messages.push(newMessage);

            // Step 3: Save the updated chat object to S3
            await uploadChatToS3(chatID, chatObject);

            // return success
            return NextResponse.json({ message: "Message sent successfully" }, { status: 200 });
          }
      } 
    }



    // Step 1: Retrieve the existing chat object from S3
    let chatObject = await getChatFromS3(chatID);

    if (!chatObject) {
      chatObject = { messages: [userMessage] };
    } else {
      // Step 2: Append the new message to the existing chat object
      chatObject.messages.push(userMessage);
    }

    // Process files to Base64
    const base64Images: string[] = [];
    const base64Documents: string[] = [];

    for (const file of files) {
      const base64String = await fileToBase64(file);
      // Sort files by type: images and documents
      if (file.type.startsWith('image/')) {
        base64Images.push(base64String);
      } else {
        base64Documents.push(base64String);
      }
    }

    // Step 3: Send the message to the external API along with the files (if any) and get the response
    const apiResponse = await sendMessageToChatAPI(userMessage.message, chatID, [brainID], base64Images, base64Documents);

    // Step 4: Append the API response message to the chat object
    chatObject.messages.push({
      message: apiResponse.message,
      author: "system", // Assume the response is from the system or AI
    });

    // Step 5: Store the updated chat object back in S3
    await uploadChatToS3(chatID, chatObject);

    // Step 6: Return a success response
    return NextResponse.json({ message: "Message sent successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error processing chat update:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
