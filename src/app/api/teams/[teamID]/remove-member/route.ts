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

// Remove Member from the team
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

        // Check if the member exists
        if (!team.members.includes(email)) {
            return NextResponse.json({ message: 'Member not found' }, { status: 404 });
        }

        // Remove the member
        let updatedMembers = team.members.filter((member) => member !== email);
        updatedMembers = updatedMembers.filter((member) => member !== hashEmail(email));

        let updatedAdmins = team.admins.filter((admin) => admin !== email);
        updatedAdmins = updatedAdmins.filter((admin) => admin !== hashEmail(email));

        const updateCommand = new UpdateCommand({
            TableName: Resource.TeamsTable.name,
            Key: { teamID },
            UpdateExpression: 'SET members = :updatedMembers, admins = :updatedAdmins',
            ExpressionAttributeValues: {
                ':updatedMembers': updatedMembers,
                ':updatedAdmins': updatedAdmins,
            },
            ReturnValues: 'ALL_NEW',
        });

        const result = await documentClient.send(updateCommand);
        return NextResponse.json({ message: 'Member removed successfully', team: result.Attributes }, { status: 200 });
    } catch (error) {
        console.error('Error removing team member:', error);
        return NextResponse.json({ message: 'Error removing team member' }, { status: 500 });
    }
}
