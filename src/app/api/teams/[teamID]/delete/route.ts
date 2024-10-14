import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

export async function POST(req: NextRequest) {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const teamID = pathSegments[pathSegments.length - 2]; // Assumes the team ID is the second last part of the path

  console.log('Team ID:', teamID);

  try {
    // Delete the team
    const deleteCommand = new DeleteCommand({
      TableName: Resource.TeamsTable.name,
      Key: { teamID },
    });

    await documentClient.send(deleteCommand);

    return NextResponse.json({ message: 'Team deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ message: 'Error deleting team' }, { status: 500 });
  }
}
