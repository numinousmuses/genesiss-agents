import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

// API Route to fetch team IDs for a user
export async function GET(request: NextRequest) {
  try {
    // Extract userID from the request URL
    const url = new URL(request.url);
    const userID = url.pathname.split('/').pop();

    if (!userID) {
      return NextResponse.json({ message: 'Invalid or missing userID' }, { status: 400 });
    }

    // Fetch the user's teams from the database
    const command = new GetCommand({
      TableName: Resource.FinalUsersTable.name, // Replace with your actual users table name
      Key: {
        userID: userID,
      },
      ProjectionExpression: 'teams', // Only retrieve teams field
    });

    const response = await documentClient.send(command);

    // If the user is found, return the list of team IDs
    if (response.Item && response.Item.teams) {
      const teamIDs = response.Item.teams;
      return NextResponse.json(teamIDs, { status: 200 });
    } else {
      return NextResponse.json({ message: 'User not found or has no teams' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error fetching team IDs:', error);
    return NextResponse.json({ message: 'Failed to fetch team IDs' }, { status: 500 });
  }
}
