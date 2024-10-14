import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

// Handler for GET request to fetch brainIDs
export async function GET(request: NextRequest) {
  try {
    // Extract userID from the request URL
    const url = new URL(request.url);
    const userID = url.pathname.split('/').pop();

    if (!userID) {
      return NextResponse.json({ message: 'Invalid or missing userID' }, { status: 400 });
    }

    // Step 1: Fetch the user information to get their teamIDs
    const user = await getUser(userID);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Step 2: Fetch brainIDs from user's personal chats
    const userBrainIDs = await getBrainIDsByUser(userID);

    // Step 3: Fetch brainIDs from team chats for all the user's teams
    const teamBrainIDs = await getBrainIDsByTeams(user.teams);

    // Step 4: Combine and return unique brainIDs from personal and team chats
    const allBrainIDs = Array.from(new Set([...userBrainIDs, ...teamBrainIDs])); // Ensure uniqueness

    return NextResponse.json(allBrainIDs, { status: 200 });
  } catch (error) {
    console.error('Error fetching brainIDs:', error);
    return NextResponse.json({ message: 'Failed to fetch brainIDs' }, { status: 500 });
  }
}

// Helper function to fetch user details (including teams) from DynamoDB
async function getUser(userID: string) {
  try {
    const command = new GetCommand({
      TableName: Resource.FinalUsersTable.name, // Replace with your actual Users table name
      Key: { userID },
    });

    const { Item } = await documentClient.send(command);
    return Item; // Returns the user object
  } catch (error) {
    console.error('Error retrieving user from DynamoDB:', error);
    return null;
  }
}

// Helper function to fetch brainIDs for a user
async function getBrainIDsByUser(userID: string) {
  try {
    const command = new QueryCommand({
      TableName: Resource.ChatsTable.name, // Replace with your actual DynamoDB table name
      IndexName: 'CreatedAtIndex', // Replace with your actual GSI name if necessary
      KeyConditionExpression: 'userID = :userID',
      ExpressionAttributeValues: {
        ':userID': userID,
      },
      ProjectionExpression: 'brainID', // Only retrieve brainIDs
    });

    const response = await documentClient.send(command);
    console.log('DynamoDB user chats response:', response);

    // Extract brainIDs from the DynamoDB response
    return response.Items?.map((item) => item.brainID).filter((brainID) => brainID) || [];
  } catch (error) {
    console.error('Error fetching brainIDs for user:', error);
    return [];
  }
}

// Helper function to fetch brainIDs for team chats
async function getBrainIDsByTeams(teamIDs: string[]) {
  try {
    if (!teamIDs || teamIDs.length === 0) {
      return [];
    }

    const brainIDs = [];

    // Iterate over each teamID and fetch the brainIDs for the team's chats
    for (const teamID of teamIDs) {
      const command = new QueryCommand({
        TableName: Resource.ChatsTable.name, // Replace with your actual DynamoDB table name
        IndexName: 'CreatedAtIndex', // Replace with your actual GSI name if necessary
        KeyConditionExpression: 'userID = :teamID',
        ExpressionAttributeValues: {
          ':teamID': teamID,
        },
        ProjectionExpression: 'brainID', // Only retrieve brainIDs
      });

      const response = await documentClient.send(command);
      console.log(`DynamoDB team chats response for teamID ${teamID}:`, response);

      // Extract brainIDs for each team and add to the brainIDs array
      brainIDs.push(...(response.Items?.map((item) => item.brainID).filter((brainID) => brainID) || []));
    }

    return brainIDs;
  } catch (error) {
    console.error('Error fetching brainIDs for teams:', error);
    return [];
  }
}
