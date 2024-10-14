/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";
import { Resource } from 'sst';
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { get } from "http";
import * as stream from 'stream';

// Initialize DynamoDB and S3 clients
const s3Client = new S3Client({ region: 'us-east-1' });
const dynamoDbClient = new DynamoDBClient({ region: "us-east-1" });
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

function handleCors(req: NextRequest) {
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
    // Respond to preflight requests with 200 status
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers });
    }
  
    return headers;
}

export interface CalledAgent {
    agent: string; // The name of the agent executed
    result: string; // The result from executing the agent
}

export interface ExecutedAgents {
    jobID: string; // Identifier for the job
    state?: string; // Optional state value
    brainID?: string; // Optional brainID for memory operations
    agents: CalledAgent[][]; // 2D array of called agents, each sub-array representing a group of agents executed in order
}


  
  interface Workflow {
    title: string;
    description: string;
    frequency: string;
    createdAt: string;
    outputs: WorkflowOutput[];
  }

interface JobResponse {
    jobID: string,
    state: string,
    agents: CalledAgent[][],
    brainID: string
}

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

interface WorkflowOutput {
    runDate: string;
    output: string;
    status: string;
    creditsConsumed: number;
}

export async function POST(req: NextRequest) {
    const headers = handleCors(req);

    try { 
        
        // receive response from genesiss api

        const data = await req.json() as JobResponse;

        const jobID = data.jobID;
        const userID = data.state;
        const agents = data.agents;



        // get workflow from db
        // const workflow = await getWorkflowFromDynamoDBByIndex(userID);

        // get output from s3 using key
        // const key = workflow!.jobID
        // update output from s3

        const outputs = await getOutputsFromS3(jobID);

        // turn agents into a markdown string, with each agent's title, then the output in a codeblock, then a new line, then repreat for all agents in the 2d array

        const markdown = agents.map((groupOfAgents) => {
            return groupOfAgents.map((agent) => {
                // Find all image URLs in agent.result
                const imageUrls = agent.result.match(/\bhttps?:\/\/\S+\.(?:png|jpg|jpeg|gif|svg)\b/g) || [];
        
                // Generate markdown for each image URL
                const imageMarkdown = imageUrls.map(url => `![Image](${url})\n\n`).join("");
        
                return `### ${agent.agent}\n\n\`\`\`\n${agent.result}\n\`\`\`\n\n${imageMarkdown}`;
            }).join("");
        }).join("");
        

        // construct a workflowoutput object based on agents const
        const workflowOutput: WorkflowOutput = {
            runDate: new Date().toISOString(),
            output: markdown,
            status: "success",
            creditsConsumed: await calculateCreditsConsumed(agents),
        }

        // add workflowoutput to outputs const
        
        const newOutputs = [...outputs, workflowOutput];

        // update s3 with new outputs

        const command = new PutObjectCommand({
            Bucket: Resource.GenesissAgentsBucket.name, // Replace with your S3 bucket name
            Key: jobID, // The S3 key is the same as the chatID
            Body: JSON.stringify(newOutputs), // The body of the PUT request is the JSON stringified version of the newOutputs array
        });

        const response = await s3Client.send(command);


        return NextResponse.json({ message: "Success" }, { status: 200 });

    }  catch (error) {
        console.error("Internal Server Error:", error);
        return NextResponse.json({ message: "Server Error" }, { status: 500 });
    }

}

async function getWorkflowFromDynamoDBByIndex(jobID: string) {
    try {
        const command = new GetCommand({
            TableName: Resource.WorkflowsTable.name, // Replace with your DynamoDB table name
            Key: { jobID },
        });

        const { Item } = await documentClient.send(command);
        return Item; // Returns the chat object from DynamoDB
    } catch (error) {
        console.error("Error retrieving workflow from DynamoDB using index:", error);
        return null;
    }
}

// Function to get chat messages from S3 using the chatID as the key
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

async function calculateCreditsConsumed(agents: CalledAgent[][]): Promise<number> {
    const creditsConsumed = 0
    return creditsConsumed;
}

// async function getWorkflowFromDynamoDBByIndex(userID: string) {
//     try {
//         const command = new QueryCommand({
//             TableName: Resource.WorkflowsTable.name, // Replace with your DynamoDB table name
//             IndexName: "UserIDIndex", // Replace with your index name
//             KeyConditionExpression: "userID = :userID",
//             ExpressionAttributeValues: {
//                 ":userID": userID,
//             },
//         });

//         const { Items } = await documentClient.send(command);
//         return Items && Items.length > 0 ? Items[0] : null; // Returns the first item if found
//     } catch (error) {
//         console.error("Error retrieving chat from DynamoDB using index:", error);
//         return null;
//     }
// }

// async function getWorkflowsByUserID(userID: string): Promise<DatabaseChat[]> {
//     try {
//         const command = new QueryCommand({
//             TableName: Resource.ChatsTable.name, // Replace with your DynamoDB table name
//             IndexName: "CreatedAtIndex", // Replace with your GSI name
//             KeyConditionExpression: 'userID = :userID',
//             ExpressionAttributeValues: {
//                 ':userID': userID,
//             },
//         });
//         const response = await documentClient.send(command);
//         if (response.Items) {
//             return response.Items as DatabaseChat[];
//         }
//         return [];
//     } catch (error) {
//         console.error(`Failed to retrieve chats for userID ${userID}`, error);
//         return [];
//     }
// }