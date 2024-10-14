import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

export async function POST(req: NextRequest) {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const teamID = pathSegments[pathSegments.length - 2]; // Assumes the team ID is the second last part of the path
    
  const { newTitle } = await req.json();

  if (!newTitle) {
    return NextResponse.json({ message: 'New team title is required' }, { status: 400 });
  }

  try {
    // Rename the team
    const updateCommand = new UpdateCommand({
      TableName: Resource.TeamsTable.name,
      Key: { teamID },
      UpdateExpression: 'SET teamName = :newTitle',
      ExpressionAttributeValues: {
        ':newTitle': newTitle,
      },
    });

    await documentClient.send(updateCommand);

    return NextResponse.json({ message: 'Team renamed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error renaming team:', error);
    return NextResponse.json({ message: 'Error renaming team' }, { status: 500 });
  }
}
