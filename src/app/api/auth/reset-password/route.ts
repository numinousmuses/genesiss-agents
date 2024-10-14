/* eslint-disable */
// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dynamoDB } from '@/lib/dynamo';
import { UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

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

export async function POST(req: NextRequest) {

  const headers = handleCors(req);

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");

  if (!token || !userId) {
    return NextResponse.json({ message: 'Invalid or missing token/userId' }, { status: 400 });
  }

  try {
    // Find the user by reset token and userId
    const result = await dynamoDB.send(new QueryCommand({
      TableName: Resource.FinalUsersTable.name,
      KeyConditionExpression: 'userID = :userId and resetToken = :resetToken',
      ExpressionAttributeValues: {
        ':userId': { S: userId },
        ':resetToken': { S: token },
      },
    }));

    if (!result.Items || result.Items.length === 0) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 400 });
    }

    const user = result.Items[0];

    // Check if newHashedPassword exists
    if (!user.newHashedPassword || !user.newHashedPassword.S) {
      return NextResponse.json({ message: 'New password not found' }, { status: 400 });
    }

    const newPasswordHash = user.newHashedPassword;

    // Update the user's passwordHash with newHashedPassword and remove newHashedPassword and resetToken
    await dynamoDB.send(new UpdateCommand({
      TableName: Resource.FinalUsersTable.name,
      Key: { userID: user.userID.S },
      UpdateExpression: 'SET passwordHash = :passwordHash REMOVE newHashedPassword, resetToken',
      ExpressionAttributeValues: {
        ':passwordHash': { S: newPasswordHash },
      },
    }));

    return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ message: 'Error resetting password', error }, { status: 500 });
  }
}
