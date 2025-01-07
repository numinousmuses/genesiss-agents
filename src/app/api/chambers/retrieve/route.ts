/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import * as stream from 'stream';
import { Resource } from "sst";

// Define the ChatResponse interface
interface ChatResponse {
    chatTitle: string;
    brainID?: string;
    messages: Message[];
  }

interface Message {
    message: string;
    author: string;
}

// Initialize DynamoDB and S3 clients
const s3Client = new S3Client({ region: 'us-east-1' });
const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);


// Main POST function to handle the chat retrieval
export async function POST(request: NextRequest) {
    try {
        // Parse the request body to get the userID and chatID
        const { userID, chatID, email } = await request.json();

        if (!userID || !chatID) {
            return NextResponse.json({ message: "Invalid or missing parameters" }, { status: 400 });
        }


        // Step 1: Fetch chat information from DynamoDB using chatID
        const chatData = await getChatFromDynamoDB(chatID);

        if (!chatData) {
            return NextResponse.json({ message: "Chat not found" }, { status: 404 });
        }

        // Step 2: Check if the user has permission to view the chat
        const hasAccess = await checkChatAccess(userID, chatData);

        if (!hasAccess) {
            return NextResponse.json({ message: "Access denied" }, { status: 403 });
        }

        // Step 3: Retrieve chat messages from S3 using the chatID as the key
        const messages = await getMessagesFromS3(chatID);


        // Step 5: Return the ChatResponse, including brainID and teamID if they exist
        const response: ChatResponse = {
            chatTitle: chatData.chatTitle,
            messages,
            brainID: chatData.brainID || undefined, // Include brainID if it exists
        };

        return NextResponse.json(response, { status: 200 });
    } catch (error) {
        console.error("Error retrieving chat:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// Function to retrieve chat data from DynamoDB using chatID
async function getChatFromDynamoDB(chatID: string) {
    try {
        const command = new GetCommand({
            TableName: Resource.ChambersChatsTable.name, // Replace with your DynamoDB table name
            Key: { chatID },
        });

        const { Item } = await documentClient.send(command);
        return Item; // Returns the chat object from DynamoDB
    } catch (error) {
        console.error("Error retrieving chat from DynamoDB:", error);
        return null;
    }
}

// Function to get chat messages from S3 using the chatID as the key
async function getMessagesFromS3(chatID: string): Promise<Message[]> {
    try {
        const command = new GetObjectCommand({
            Bucket: Resource.GenesissAgentsBucket.name, // Replace with your S3 bucket name
            Key: chatID, // The S3 key is the same as the chatID
        });
        const response = await s3Client.send(command);

        if (response.Body instanceof stream.Readable) {
            const data = await streamToString(response.Body);
            return JSON.parse(data) as Message[];
        } else {
            throw new Error("Unexpected data type for S3 object body");
        }
    } catch (error) {

        console.error("Error retrieving messages from S3:", error);
        return [];
    }
}

// Helper function to convert stream data to string
export const streamToString = (stream: stream.Readable): Promise<string> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });

// Function to check if the user has access to the chat
// Function to check if the user has access to the chat
async function checkChatAccess(userID: string, chatData: any): Promise<boolean> {
    // const viewersArray = Array.isArray(chatData.viewers) ? chatData.viewers : [];
    // const editorsArray = Array.isArray(chatData.editors) ? chatData.editors : [];

    // // Check if the user is listed as a viewer or editor
    // if (viewersArray.includes(userID) || editorsArray.includes(userID)) {
    //     return true;
    // }

    // // If there are no specific viewers or editors, check if the entire team has access
    // if (editorsArray.length === 0) {
    //     return true;
    // }

    // // If the chat belongs to a team, check if the user is part of that team
    // if (chatData.teamID) {
    //     const teamData = await getTeamFromDynamoDB(chatData.teamID);
    //     if (!teamData) {
    //         return false; // Team not found, deny access
    //     }

    //     // Check if the user is an admin or member of the team
    //     if (teamData.admins.includes(userID) || teamData.members.includes(userID)) {
    //         return true;
    //     }
    // }

    // If the userID is the same as the owner of the chat, grant access
    if (chatData.userID === userID) {
        return true;
    }

    return false; // If none of the conditions are met, deny access
}


// Function to check if the user is an admin for the chat
// Function to check if the user is an admin for the chat
// Function to check if the user is an admin for the chat
// async function checkIfAdmin(userID: string, chatData: any): Promise<boolean> {
//     const editorsArray = Array.isArray(chatData.editors) ? chatData.editors : [];
//     const viewersArray = Array.isArray(chatData.viewers) ? chatData.viewers : [];
//     let isAdmin = false;

//     // Check if the user is in the editors list
//     if (editorsArray.includes(userID)) {
//         isAdmin = true;
//     }

//     // If the chat belongs to a team, check if the user is an admin of that team
//     if (chatData.teamID) {
//         const teamData = await getTeamFromDynamoDB(chatData.teamID);
//         if (teamData && teamData.admins.includes(userID)) {
//             isAdmin = true;

//             // If the user is an admin but not in viewers or editors, add them
//             if (!viewersArray.includes(userID)) {
//                 viewersArray.push(userID);
//             }

//             if (!editorsArray.includes(userID)) {
//                 editorsArray.push(userID);
//             }

//             // Update the chat with the new viewers and editors lists
//             await updateChatPermissions(chatData.chatID, viewersArray, editorsArray);
//         }
//     }

//     // If the userID is the same as the owner of the chat, grant admin rights
//     if (chatData.userID === userID) {
//         isAdmin = true;
//     }

//     return isAdmin; // Return true if the user is an admin
// }

// Helper function to update chat permissions in DynamoDB
async function updateChatPermissions(chatID: string, viewersArray: string[], editorsArray: string[]) {
    try {
        const updateCommand = new UpdateCommand({
            TableName: Resource.ChambersChatsTable.name,
            Key: { chatID },
            UpdateExpression: "SET viewers = :viewers, editors = :editors",
            ExpressionAttributeValues: {
                ":viewers": viewersArray,
                ":editors": editorsArray,
            },
        });

        await documentClient.send(updateCommand);
    } catch (error) {
        console.error("Error updating chat permissions in DynamoDB:", error);
    }
}

// Function to retrieve team data from DynamoDB using teamID
// async function getTeamFromDynamoDB(teamID: string) {
//     try {
//         const command = new GetCommand({
//             TableName: Resource.TeamsTable.name, // Replace with your DynamoDB table name
//             Key: { teamID },
//         });

//         const { Item } = await documentClient.send(command);
//         return Item; // Returns the team object from DynamoDB
//     } catch (error) {
//         console.error("Error retrieving team from DynamoDB:", error);
//         return null;
//     }
// }
