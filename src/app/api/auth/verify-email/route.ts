/* eslint-disable */
// app/api/auth/verify-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { Resource } from 'sst';
import { Result } from 'postcss';
import Cors from 'cors';

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

export async function GET(req: NextRequest) {

  const headers = handleCors(req);

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const token = searchParams.get('token');
  const email = searchParams.get('email');



  if (!userId || !token || !email) {
    return NextResponse.json({ message: 'Invalid or missing token/userId' }, { status: 400 });
  }

  let user

  const client = new DynamoDBClient({});

  try {
    // Get the user by userId
    const result = await client.send(new GetItemCommand({
      TableName: Resource.FinalUsersTable.name,
      Key: {
        userID: { S: userId },
      },
    }));

    console.log("RESULT")
    console.log(result);

    user = result.Item;

    if (!result.Item || result.Item.verificationToken.S != token || !result.Item.email) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 400 });
    }

    // Update user verification status
    await client.send(new UpdateItemCommand({
      TableName: Resource.FinalUsersTable.name,
      Key: {
        userID: { S: userId },
      },
      UpdateExpression: 'SET isVerified = :true REMOVE verificationToken',
      ExpressionAttributeValues: {
        ':true': { BOOL: true },
      },
    }));

    return NextResponse.redirect(new URL('/login', req.url));
  } catch (error) {
    if(user!.isVerified && user!.isVerified.BOOL == true){ return NextResponse.redirect(new URL('/login', req.url));}
    console.log(error);

    return NextResponse.json({ message: 'Error verifying email', error }, { status: 500 });
  }
}
