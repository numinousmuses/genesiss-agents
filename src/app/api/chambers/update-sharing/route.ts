import { NextRequest, NextResponse } from "next/server";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Resource } from "sst";
import { hashEmail } from "@/lib/utils";

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

export async function POST(request: NextRequest) {
  try {
    const { chatID, viewPermissions, editPermissions } = await request.json();

    // Add debug logging to check the incoming values
    console.log("Incoming viewPermissions:", viewPermissions);
    console.log("Incoming editPermissions:", editPermissions);

    if (!chatID) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    // Function to combine original emails and their hashes
    const combineEmailsAndHashes = (emails: any): string[] => {
      // Ensure emails is an array, even if it's undefined or null
      const validEmails = Array.isArray(emails) ? emails : [];
      return validEmails.reduce((acc: string[], email: string) => {
        if (typeof email === "string") {
          return acc.concat([email, hashEmail(email)]);
        }
        return acc;
      }, []);
    };

    // Combine original emails with hashed emails for both viewPermissions and editPermissions
    const updatedViewPermissions = combineEmailsAndHashes(viewPermissions);
    const updatedEditPermissions = combineEmailsAndHashes(editPermissions);

    // Add debug logging to check combined permissions
    console.log("Updated viewPermissions:", updatedViewPermissions);
    console.log("Updated editPermissions:", updatedEditPermissions);

    // Update the view and edit permissions in DynamoDB
    const updateCommand = new UpdateCommand({
      TableName: Resource.ChatsTable.name,
      Key: { chatID },
      UpdateExpression: "SET viewers = :viewers, editors = :editors",
      ExpressionAttributeValues: {
        ":viewers": updatedViewPermissions,
        ":editors": updatedEditPermissions,
      },
    });

    await documentClient.send(updateCommand);

    return NextResponse.json({ message: "Sharing settings updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error updating sharing settings:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
