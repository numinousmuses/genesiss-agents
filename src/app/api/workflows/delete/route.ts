import { NextRequest, NextResponse } from "next/server";
import { Resource } from 'sst';
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);
const s3Client = new S3Client({ region: 'us-east-1' });

interface DeleteWorkflowRequest {
    userID: string;
    workflowID: string;
}

export async function DELETE(request: NextRequest) {
    try {
        const { userID, workflowID } = await request.json() as DeleteWorkflowRequest;

        // make a delete http request to genesiss.tech/api/jobs/delete

        const deleteJobResponse = await fetch(`https://genesiss.tech/api/jobs/${userID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ak: Resource.GenesissAgentsAPIKey.value,
                jobID: workflowID,
            }),
        });

        // Delete the workflow record from DynamoDB
        const deleteCommand = new DeleteCommand({
            TableName: Resource.WorkflowsTable.name, // DynamoDB table name
            Key: {
                userID: userID,
                jobID: workflowID, // Assuming workflowID is equivalent to title here; update if using a different key
            },
        });

        await documentClient.send(deleteCommand);
        
        // Optionally, delete the associated S3 data by jobID if applicable
        const deleteS3Command = new DeleteObjectCommand({
            Bucket: Resource.WorkflowsTable.name, // Replace with the actual S3 bucket name
            Key: workflowID, // Assuming jobID matches workflowID in S3
        });

        await s3Client.send(deleteS3Command);

        return NextResponse.json({ message: "Workflow deleted successfully" }, { status: 200 });

    } catch (error) {
        console.error("Error deleting workflow:", error);
        return NextResponse.json({ message: "Error deleting workflow" }, { status: 500 });
    }
}
