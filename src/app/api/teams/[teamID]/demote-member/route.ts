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

// Demote an admin member to regular member
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
        if (!teamData.Item || !teamData.Item.admins.includes(email)) {
            return NextResponse.json({ message: 'Member not found in team' }, { status: 400 });
        }

        if (!teamData.Item) {
            return NextResponse.json({ message: 'Team not found' }, { status: 404 });
        }

        const team = teamData.Item as Team;

        // Check if the member is an admin
        if (!team.admins.includes(email)) {
            return NextResponse.json({ message: 'Member is not an admin' }, { status: 400 });
        }

        // Demote the admin member
        let updatedAdmins = team.admins.filter((admin) => admin !== email);

        updatedAdmins = updatedAdmins.filter((admin) => admin !== hashEmail(email));

        const updateCommand = new UpdateCommand({
            TableName: Resource.TeamsTable.name,
            Key: { teamID },
            UpdateExpression: 'SET admins = :updatedAdmins',
            ExpressionAttributeValues: {
                ':updatedAdmins': updatedAdmins,
            },
            ReturnValues: 'ALL_NEW',
        });

        const result = await documentClient.send(updateCommand);

        // also add the member to the members list
        const updatedMembers = [...team.members, email, hashEmail(email)];
        const updateCommand2 = new UpdateCommand({
            TableName: Resource.TeamsTable.name,
            Key: { teamID },
            UpdateExpression: 'SET members = :updatedMembers',
            ExpressionAttributeValues: {
                ':updatedMembers': updatedMembers,
            },
            ReturnValues: 'ALL_NEW',
        });

        const result2 = await documentClient.send(updateCommand2);

        
        return NextResponse.json({ message: 'Member demoted successfully', team: result2.Attributes }, { status: 200 });
    } catch (error) {
        console.error('Error demoting member:', error);
        return NextResponse.json({ message: 'Error demoting member' }, { status: 500 });
    }
}
