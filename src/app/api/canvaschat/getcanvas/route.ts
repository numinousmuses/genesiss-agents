import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import * as stream from "stream";

interface Block {
    id: number;
    content: string;
    isEditing: boolean;
}

// Initialize the S3 client
const s3Client = new S3Client({ region: "us-east-1" });

export async function POST(req: NextRequest) {
    try {
        const { chatID } = await req.json();

        if (!chatID) {
            return NextResponse.json({ error: "chatID is required" }, { status: 400 });
        }

        const canvasData = await getCanvasFromS3(chatID);

        if (canvasData) {
            return NextResponse.json({ canvas: canvasData });
        } else {
            return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
        }
    } catch (error) {
        console.error("Error in /getcanvas API route:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

const getCanvasFromS3 = async (chatID: string): Promise<Block[] | null> => {
    try {
        const command = new GetObjectCommand({
            Bucket: Resource.GenesissAgentsBucket.name, // Replace with your S3 bucket name
            Key: "GENESISSCANVAS" + chatID,             // S3 key format using chatID
        });

        const response = await s3Client.send(command);

        if (response.Body instanceof stream.Readable) {
            const data = await streamToString(response.Body);
            return JSON.parse(data) as Block[];
        } else {
            throw new Error("Unexpected response body type from S3");
        }
    } catch (error) {
        console.error("Error retrieving canvas from S3:", error);
        return null;
    }
};

const streamToString = (stream: stream.Readable): Promise<string> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
