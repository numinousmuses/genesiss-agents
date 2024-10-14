import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

// Initialize DynamoDB Client
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

// Define the structure of a team
interface Team {
    id: string;
    name: string;
    members: string[];
}

// Handler for the POST request to fetch teams
export async function POST(req: NextRequest) {
    try {
        // Parse the request body to get userId and teamIDs
        const { userId, teamIDs } = await req.json();

        // Validate input
        if (!userId || !Array.isArray(teamIDs) || teamIDs.length === 0) {
            return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
        }

        // Fetch the user from the users table to verify access (optional, can be removed if unnecessary)
        const userCommand = new GetCommand({
            TableName: Resource.FinalUsersTable.name, // Replace with your actual users table name
            Key: {
                userID: userId,
            },
        });

        const userResponse = await documentClient.send(userCommand);

        if (!userResponse.Item) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        // Fetch teams based on the teamIDs and filter where the user is an admin
        const teams: Team[] = [];
        for (const teamID of teamIDs) {
            const teamCommand = new GetCommand({
                TableName: Resource.TeamsTable.name, // Replace with your actual teams table name
                Key: {
                    teamID: teamID,
                },
            });

            const teamResponse = await documentClient.send(teamCommand);

            if (teamResponse.Item) {
                const team = teamResponse.Item;

                // Only include teams where the user is in the admins list
                if (team.admins.includes(userId)) {
                    teams.push({
                        id: team.teamID,
                        name: team.teamName,
                        members: [...team.admins, ...team.members], // Combine admins and members
                    });
                }
            }
        }

        // Return the fetched teams where the user is an admin
        return NextResponse.json(teams, { status: 200 });
    } catch (error) {
        console.error('Error fetching teams:', error);
        return NextResponse.json({ message: 'Failed to fetch teams' }, { status: 500 });
    }
}