/* eslint-disable */
// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { Resource } from "sst";
import { v4 as uuidv4 } from "uuid";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { userId, action, oldEmail, newEmail, newUsername } = await req.json();

  if (!userId || !action) {
    return NextResponse.json(
      { message: "Invalid or missing parameters" },
      { status: 400 }
    );
  }

  const client = new DynamoDBClient({ region: "us-east-1" });

  try {
    switch (action) {
      case "changeEmail":
        if (!newEmail) {
          return NextResponse.json(
            { message: "New email is required" },
            { status: 400 }
          );
        }

        // Get the current user's email
        const result = await client.send(
          new GetItemCommand({
            TableName: Resource.FinalUsersTable.name,
            Key: {
              userID: { S: userId },
            },
          })
        );

        const currentUser = result.Item;
        if (!currentUser || !currentUser.email) {
          return NextResponse.json(
            { message: "User not found" },
            { status: 404 }
          );
        }

        // Send verification email to the current email
        const verificationToken = uuidv4();
        await sendVerificationEmail(
          currentUser.email.S!,
          userId,
          verificationToken, true
        );

        // Temporarily store new email and verification token
        await client.send(
          new UpdateItemCommand({
            TableName: Resource.FinalUsersTable.name,
            Key: {
              userID: { S: userId },
            },
            UpdateExpression:
              "SET pendingEmail = :newEmail, verificationToken = :token",
            ExpressionAttributeValues: {
              ":newEmail": { S: newEmail },
              ":token": { S: verificationToken },
            },
          })
        );

        return NextResponse.json({
          message: "Verification email sent. Please check your inbox.",
        });

      case "changeUsername":
        if (!newUsername) {
          return NextResponse.json(
            { message: "New username is required" },
            { status: 400 }
          );
        }

        // Update the username
        await client.send(
          new UpdateItemCommand({
            TableName: Resource.FinalUsersTable.name,
            Key: {
              userID: { S: userId },
            },
            UpdateExpression: "SET username = :newUsername",
            ExpressionAttributeValues: {
              ":newUsername": { S: newUsername },
            },
          })
        );

        return NextResponse.json({
          message: "Username changed successfully",
        });

      case "deleteAccount":
        // Delete the user account
        await client.send(
          new DeleteItemCommand({
            TableName: Resource.FinalUsersTable.name,
            Key: {
              userID: { S: userId },
            },
          })
        );

        return NextResponse.json({
          message: "Account deleted successfully",
        });

      default:
        return NextResponse.json(
          { message: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error processing request", error);
    return NextResponse.json(
      { message: "Error processing request", error },
      { status: 500 }
    );
  }
}
