/* eslint-disable */
import {NextRequest, NextResponse} from "next/server";
import { Resource } from 'sst';
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import * as stream from 'stream';

const s3Client = new S3Client({ region: 'us-east-1' });
const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

interface WorkflowOutput {
    runDate: string;
    output: string;
    status: string;
    creditsConsumed: number;
}

interface Workflow {
    title: string;
    description: string;
    frequency: string;
    createdAt: string;
    jobID: string;
    outputs: WorkflowOutput[];
}

interface DatabaseWorkflow {
    title: string,
    jobID: string,
    userID: string,
    description: string,
    frequency: string,
    createdAt: string,
}

export async function POST(request: NextRequest) {
    

    try {
        const body = await request.json();

        const userID = body.userID;

        // get workflows for user

        const retrievedworkflows = await getWorkflowsByUserID(userID)


        // construct workflow[] object by mapping each of the relevant elements from database workflow to workflow
        const workflows: Workflow[] = await Promise.all(
            retrievedworkflows.map(async (dbWorkflow) => {
                // Retrieve outputs from S3 for each workflow by jobID
                const outputs = await getOutputsFromS3(dbWorkflow.jobID);

                // Map the combined data into a Workflow object
                return {
                    title: dbWorkflow.title,
                    description: dbWorkflow.description,
                    frequency: dbWorkflow.frequency,
                    createdAt: dbWorkflow.createdAt,
                    jobID: dbWorkflow.jobID,
                    outputs: outputs,
                };
            })
        );

        // return workflow[]
        // Return the constructed workflows array
        return NextResponse.json(workflows);
    } catch (error) {
        console.error("Workflows Get Error:", error);
        return NextResponse.json({ message: "Error Retrieving Workflows" }, { status: 500 });
    }
}

async function getWorkflowsByUserID(userID: string): Promise<DatabaseWorkflow[]> {
    try {
        const command = new QueryCommand({
            TableName: Resource.WorkflowsTable.name, // Replace with your DynamoDB table name
            IndexName: "UserIDIndex", // Replace with your GSI name
            KeyConditionExpression: 'userID = :userID',
            ExpressionAttributeValues: {
                ':userID': userID,
            },
        });
        const response = await documentClient.send(command);
        if (response.Items) {
            return response.Items as DatabaseWorkflow[];
        }
        return [];
    } catch (error) {
        console.error(`Failed to retrieve chats for userID ${userID}`, error);
        return [];
    }
}

async function getOutputsFromS3(jobID: string): Promise<WorkflowOutput[]> {
    try {
        const command = new GetObjectCommand({
            Bucket: Resource.WorkflowsTable.name, // Replace with your S3 bucket name
            Key: jobID, // The S3 key is the same as the chatID
        });
        const response = await s3Client.send(command);

        if (response.Body instanceof stream.Readable) {
            const data = await streamToString(response.Body);
            return JSON.parse(data) as WorkflowOutput[];
        } else {
            throw new Error("Unexpected data type for S3 object body");
        }
    } catch (error) {

        console.error("Error retrieving messages from S3:", error);
        return [];
    }
}

// Helper function to convert stream data to string
export const streamToString = (stream: stream.Readable): Promise<string> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
});