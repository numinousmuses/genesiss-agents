/* eslint-disable */
// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dynamoDB } from '@/lib/dynamo';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get('sessionId')?.value;

  if (!sessionId) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  // Extract email and userId from sessionId
  const [uuid, email, userId] = sessionId.split('&');

  try {
    const result = await dynamoDB.send(new GetCommand({
      TableName: Resource.GenesissAgentsSessionsTable.name,
      Key: {
        sessionId: sessionId,
        userId: userId,
      },
    }));

    const sessionData = result.Item;
    console.log("SESSIONDATA")
    console.log(sessionData);

    if (!sessionData) {
      return NextResponse.json({ message: 'Session not found' }, { status: 404 });
    }
    

    return NextResponse.json({
      userId: sessionData.userId,
      email: sessionData.email,
      username: sessionData.username,
    }, { status: 200 });
  } catch (error) {
    console.error('Error retrieving session:', error);
    return NextResponse.json({ message: 'Error retrieving session', error }, { status: 500 });
  }
}
