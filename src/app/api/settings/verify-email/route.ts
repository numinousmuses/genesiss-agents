/* eslint-disable */
// app/api/auth/verify-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { Resource } from "sst";

function handleCors(req: NextRequest) {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');

  // Respond to preflight requests with 200 status
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  return headers;
}

export async function GET(req: NextRequest) {

  const headers = handleCors(req);

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");

  if (!userId || !token) {
    return NextResponse.json(
      { message: "Invalid or missing token/userId" },
      { status: 400 }
    );
  }

  const client = new DynamoDBClient({ region: "us-east-1" });

  try {
    // Get the user by userId
    const result = await client.send(new GetItemCommand({
        TableName: Resource.FinalUsersTable.name,
        Key: {
          userID: { S: userId },
        },
      }));

    const user = result.Item;

    if (!user || user.verificationToken.S !== token) {
      return NextResponse.json({ message: "Invalid token" }, { status: 400 });
    }

    const pendingEmail = user.pendingEmail?.S;

    // Update user verification status
    await client.send(
      new UpdateItemCommand({
        TableName: Resource.FinalUsersTable.name,
        Key: {
            userID: { S: userId },
        },
        UpdateExpression:
          "SET isVerified = :true REMOVE verificationToken, pendingEmail",
        ExpressionAttributeValues: {
          ":true": { BOOL: true },
        },
      })
    );

    // If there is a pending email, update it as the new email
    if (pendingEmail) {
      await client.send(
        new UpdateItemCommand({
          TableName: Resource.FinalUsersTable.name,
          Key: {
            userID: { S: userId },
          },
          UpdateExpression: "SET email = :newEmail",
          ExpressionAttributeValues: {
            ":newEmail": { S: pendingEmail },
          },
        })
      );
    }

    alert("Email verified!");
    return NextResponse.redirect(new URL("/login", req.url));
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { message: "Error verifying email", error },
      { status: 500 }
    );
  }
}
