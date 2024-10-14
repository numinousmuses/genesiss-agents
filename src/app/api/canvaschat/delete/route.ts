import { NextRequest, NextResponse } from "next/server";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Resource } from "sst";

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

export async function POST(req: NextRequest) {
  try {
    // Parse the request body to get the chatID
    const { chatID } = await req.json();

    // Validate input
    if (!chatID) {
      return NextResponse.json({ message: "Invalid or missing chatID" }, { status: 400 });
    }

    // Step 1: Delete the chat from the DynamoDB table
    const deleteCommand = new DeleteCommand({
      TableName: Resource.CanvasChatsTable.name, // Replace with your actual table name
      Key: {
        chatID: chatID,
      },
    });

    await documentClient.send(deleteCommand);

    // Return success response
    return NextResponse.json({ message: "Chat deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete chat", error);
    return NextResponse.json({ message: "Failed to delete chat" }, { status: 500 });
  }
}
