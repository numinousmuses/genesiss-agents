import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
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

}

const getCanvasFromS3 = async (chatID: string): Promise<Block[] | null> => {
    try {
      const command = new GetObjectCommand({
        Bucket: Resource.GenesissAgentsBucket.name, // Your S3 bucket name
        Key: "GENESISSCANVAS" + chatID, // The chatID is used as the key
      });
  
      const response = await s3Client.send(command);
      if (response.Body instanceof stream.Readable) {
        const data = await streamToString(response.Body);
        return JSON.parse(data) as Block[];
      } else {
        throw new Error("Unexpected response body type from S3");
      }
    } catch (error) {
      console.error("Error retrieving chat from S3:", error);
      return null;
    }
  };