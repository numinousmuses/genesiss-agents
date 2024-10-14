/* eslint-disable */
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

// Promote a member to admin
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
            TableName: Resource.TeamsTable.name,
            Key: { teamID },
        });
        const teamData = await documentClient.send(getTeamCommand);

        // if email is not in team members, return error
        if (!teamData.Item || !teamData.Item.members.includes(email)) {
            return NextResponse.json({ message: 'Member not found in team' }, { status: 400 });
        }

        if (!teamData.Item) {
            return NextResponse.json({ message: 'Team not found' }, { status: 404 });
        }

        const team = teamData.Item as Team;

        // Check if the member is already an admin
        if (team.admins.includes(email)) {
            return NextResponse.json({ message: 'Member is already an admin' }, { status: 400 });
        }

        // Promote the member to admin
        let updatedAdmins = [...team.admins, email, hashEmail(email)];

        // Remove the member from the members list if they exist
        let updatedMembers = team.members.filter((member) => member !== email && member !== hashEmail(email));

        const updateCommand = new UpdateCommand({
            TableName: Resource.TeamsTable.name,
            Key: { teamID },
            UpdateExpression: 'SET admins = :updatedAdmins, members = :updatedMembers',
            ExpressionAttributeValues: {
                ':updatedAdmins': updatedAdmins,
                ':updatedMembers': updatedMembers,
            },
            ReturnValues: 'ALL_NEW',
        });

        const result = await documentClient.send(updateCommand);

        return NextResponse.json({ message: 'Member promoted to admin successfully', team: result.Attributes }, { status: 200 });
    } catch (error) {
        console.error('Error promoting member to admin:', error);
        return NextResponse.json({ message: 'Error promoting member to admin' }, { status: 500 });
    }
}
