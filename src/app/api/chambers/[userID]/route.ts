/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Resource } from "sst";

interface Chat {
    chatID: string,
    chatTitle: string,
    timestamp: string,
    messages: Message[],
    brainID?: string,
}

interface Message {
    author: string,
    message: string
}

interface DatabaseChat {
    chatTitle: string,
    chatID: string, // primary index, also the S3 key for the chat object
    userID: string, // equals the user's ID
    editors: string[], // if empty, user can access
    viewers: string[], // if empty, user can access
    messages: string, // s3 link to an object:  Message[] stored in S3
    timestamp: string,
    brainID?: string,
}

// Initialize AWS clients
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);
const s3Client = new S3Client({ region: 'us-east-1' });

// Helper function to get messages from S3
async function getMessagesFromS3(chatID: string): Promise<Message[]> {
    try {
        const command = new GetObjectCommand({
            Bucket: Resource.GenesissAgentsBucket.name, // Replace with your S3 bucket name
            Key: chatID, // Key is the same as chatID
        });
        const response = await s3Client.send(command);

        // Parse the messages from the S3 response
        const messages: Message[] = JSON.parse(await streamToString(response.Body));
        return messages;
    } catch (error) {
        console.error(`Failed to retrieve messages from S3 for chatID ${chatID}`, error);
        return [];
    }
}

// Helper function to convert S3 stream to string
async function streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", (chunk: Buffer | Uint8Array) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString('utf-8')));
        stream.on("error", reject);
    });
}

// Helper function to get chats based on userID
async function getChatsByUserID(userID: string): Promise<DatabaseChat[]> {
    try {
        const command = new QueryCommand({
            TableName: Resource.ChatsTable.name, // Replace with your DynamoDB table name
            IndexName: "CreatedAtIndex", // Replace with your GSI name
            KeyConditionExpression: 'userID = :userID',
            ExpressionAttributeValues: {
                ':userID': userID,
            },
        });
        const response = await documentClient.send(command);
        if (response.Items) {
            return response.Items as DatabaseChat[];
        }
        return [];
    } catch (error) {
        console.error(`Failed to retrieve chats for userID ${userID}`, error);
        return [];
    }
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const userID = url.pathname.split('/').pop(); // Extract userId from the URL
    if (!userID) {
        return NextResponse.json({ message: "Invalid or missing userID" }, { status: 400 });
    }

    try {
        // Step 1: Get chats associated with the user's ID directly
        const userChats = await getChatsByUserID(userID);

        // Step 2: Initialize Chat objects array
        const chats: Chat[] = [];

        // Step 3: Filter user chats based on viewer access
        for (const chat of userChats) {
            // Check viewer permissions

            let messages: Message[] = [];
            try {
                // Retrieve messages from S3
                messages = await getMessagesFromS3(chat.chatID);
            } catch (error) {
                console.error(`Failed to retrieve messages from S3 for chatID ${chat.chatID}`, error);
                continue;
            }

            chats.push({
                chatID: chat.chatID,
                chatTitle: chat.chatTitle,
                timestamp: chat.timestamp,
                messages,
                brainID: chat.brainID,
            });
        }

        // Return the list of chats
        return NextResponse.json(chats, { status: 200 });
    } catch (error) {
        console.error("Failed to retrieve chats", error);
        return NextResponse.json({ message: "Failed to retrieve chats" }, { status: 500 });
    }
}
