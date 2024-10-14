// api/chats/rename/route.ts

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Resource } from "sst";

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

export async function POST(request: NextRequest) {
  try {
    const { chatID, newChatTitle } = await request.json();

    if (!chatID || !newChatTitle) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    // Update chat title in DynamoDB
    const updateCommand = new UpdateCommand({
      TableName: Resource.CanvasChatsTable.name,
      Key: { chatID },
      UpdateExpression: "SET chatTitle = :newTitle",
      ExpressionAttributeValues: {
        ":newTitle": newChatTitle,
      },
    });

    await documentClient.send(updateCommand);

    return NextResponse.json({ message: "Chat renamed successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error renaming chat:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
