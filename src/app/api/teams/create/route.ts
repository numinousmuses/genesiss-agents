import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid'; // For generating unique team IDs
import { Resource } from 'sst';

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

export async function POST(request: NextRequest) {
  try {
    // Parse the request body to get userId and teamTitle
    const { userId, teamTitle, email } = await request.json();

    // Validate inputs
    if (!userId || !teamTitle.trim()) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    // Generate a new teamID
    const teamID = uuidv4().replace(/-/g, '');

    // Step 1: Create a new team in the Teams table
    const newTeamCommand = new PutCommand({
      TableName: Resource.TeamsTable.name, // Replace with your actual teams table name
      Item: {
        teamID: teamID,
        teamName: teamTitle,
        admins: [email, userId], // The creator of the team becomes the admin
        members: [], // Initially, no other members
      },
    });

    await documentClient.send(newTeamCommand);

    // Step 2: Update the user's teams array in the Users table
    const updateUserTeamsCommand = new UpdateCommand({
      TableName: Resource.FinalUsersTable.name, // Replace with your actual users table name
      Key: {
        userID: userId,
      },
      UpdateExpression: "SET teams = list_append(if_not_exists(teams, :emptyList), :newTeamID)",
      ExpressionAttributeValues: {
        ":newTeamID": [teamID], // Append the new team ID to the user's teams array
        ":emptyList": [], // For users with no teams, initialize with an empty array
      },
    });

    await documentClient.send(updateUserTeamsCommand);

    // Return success response
    return NextResponse.json({ message: "Team created successfully", teamID }, { status: 201 });

  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json({ message: "Failed to create team" }, { status: 500 });
  }
}
