import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import * as stream from "stream";

// Define the Block type
interface Block {
  id: number;
  content: string;
  isEditing: boolean;
}

// Initialize the S3 client
const s3Client = new S3Client({ region: "us-east-1" });

// Helper function to upload updated canvas data to S3
const updateCanvasInS3 = async (chatID: string, canvas: Block[]): Promise<boolean> => {
  try {
    const command = new PutObjectCommand({
      Bucket: Resource.GenesissAgentsBucket.name, // Your S3 bucket name
      Key: "GENESISSCANVAS" + chatID, // Use the chatID as the key
      Body: JSON.stringify(canvas),
      ContentType: "application/json",
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("Error updating canvas in S3:", error);
    return false;
  }
};

// Main handler function for the route
export async function POST(req: NextRequest) {
  try {
    const { chatID, canvas } = await req.json();

    if (!chatID || !Array.isArray(canvas)) {
      return NextResponse.json(
        { error: "Invalid request: chatID and canvas are required" },
        { status: 400 }
      );
    }

    const success = await updateCanvasInS3(chatID, canvas);
    if (!success) {
      throw new Error("Failed to update canvas in S3");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in update canvas route:", error);
    return NextResponse.json(
      { error: "Failed to update canvas" },
      { status: 500 }
    );
  }
}
