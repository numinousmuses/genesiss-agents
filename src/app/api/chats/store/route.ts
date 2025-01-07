import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import * as stream from "stream";

const s3Client = new S3Client({ region: "us-east-1" });

interface Message {
  message: string;
  author: string;
}

interface ChatObject {
  messages: Message[];
}

// Helper function to read stream content
const streamToString = (stream: stream.Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });

// Function to retrieve a chat from S3
const getChatFromS3 = async (chatID: string): Promise<ChatObject | null> => {
  try {
    const command = new GetObjectCommand({
      Bucket: Resource.GenesissAgentsBucket.name,
      Key: chatID,
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

// Function to upload chat updates to S3
const uploadChatToS3 = async (chatID: string, updatedChat: ChatObject): Promise<void> => {
  try {
    const command = new PutObjectCommand({
      Bucket: Resource.GenesissAgentsBucket.name,
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

// Main route handler for storing messages
export async function POST(request: NextRequest) {
  try {
    const { chatID, message, response, graphgen } = await request.json();

    if (!chatID || !message || !response) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    // Retrieve existing chat data or create a new one
    let chatObject = await getChatFromS3(chatID);
    if (!chatObject) {
      chatObject = { messages: [] };
    }

    // Append the user and system messages to the chat
    chatObject.messages.push({ message, author: "User" });
    chatObject.messages.push({ message: response, author: graphgen ? "graphgen" : "System" });

    // Upload the updated chat object to S3
    await uploadChatToS3(chatID, chatObject);

    return NextResponse.json({ message: "Messages stored successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error storing messages:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
