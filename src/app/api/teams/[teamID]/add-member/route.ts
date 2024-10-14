import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { hashEmail } from '@/lib/utils';

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

interface Team {
    teamID: string;
    teamName: string;
    admins: string[];
    members: string[];
}

// Add Member to the team
export async function POST(req: NextRequest) {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const teamID = pathSegments[pathSegments.length - 2]; // Assumes the team ID is the second last part of the path
    const { email } = await req.json();

    if (!teamID || !email) {
        return NextResponse.json({ message: 'Team ID and email are required' }, { status: 400 });
    }

    try {
        // Get the team by teamID
        const getTeamCommand = new GetCommand({
            TableName: Resource.TeamsTable.name, // Your actual table name
            Key: { teamID },
        });
        const teamData = await documentClient.send(getTeamCommand);

        if (!teamData.Item) {
            return NextResponse.json({ message: 'Team not found' }, { status: 404 });
        }

        const team = teamData.Item as Team;

        // Check if the email already exists in the members list
        if (team.members.includes(email)) {
            return NextResponse.json({ message: 'Member already exists' }, { status: 400 });
        }

        // Add the member
        const updateCommand = new UpdateCommand({
            TableName: Resource.TeamsTable.name,
            Key: { teamID },
            UpdateExpression: 'SET members = list_append(members, :newMember)',
            ExpressionAttributeValues: {
                ':newMember': [email, hashEmail(email)],
            },
            ReturnValues: 'ALL_NEW',
        });

        const result = await documentClient.send(updateCommand);
        return NextResponse.json({ message: 'Member added successfully', team: result.Attributes }, { status: 200 });
    } catch (error) {
        console.error('Error adding team member:', error);
        return NextResponse.json({ message: 'Error adding team member' }, { status: 500 });
    }
}
