/* eslint-disable */
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dynamoDB } from '@/lib/dynamo';
import { hashEmail, comparePassword } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { PutItemCommand } from '@aws-sdk/client-dynamodb';


const sessions = new Map<string, { userId: string; email: string; username: string }>();

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const userId = hashEmail(email);
  console.log("USERID")
  console.log(userId);

  try {
    const result = await dynamoDB.send(new GetCommand({
      TableName: Resource.FinalUsersTable.name,
      Key: {
        userID: userId,
      },
    }));

    console.log("RESULT")
    console.log(result);

    const user = result.Item;
    console.log("USER")
    console.log(user);

    if (!user || !comparePassword(password, user.passwordHash)) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.isVerified) {
      return NextResponse.json({ message: 'Email not verified' }, { status: 403 });
    }

    // Create a unique sessionId
    const sessionId = `${uuidv4()}&${email}&${userId}`;
    console.log("SESSIONID")
    console.log(sessionId);
    


    // Store session data in DynamoDB
    const secondres = await dynamoDB.send(new PutItemCommand({
      TableName: Resource.GenesissAgentsSessionsTable.name,
      Item: {
        sessionId: { S: sessionId },
        userId: { S: userId },
        email: { S: email },
        username: { S: user.username },
      },
    }));

    console.log("SECONDRES")
    console.log(secondres);

    return NextResponse.json({ message: 'Login successful' }, {
      status: 200,
      headers: {
        'Set-Cookie': `sessionId=${sessionId}; Path=/; HttpOnly`,
      },
    });
  } catch (error) {
    console.log(error)
    // console.log(error.message)
    return NextResponse.json({ message: 'Error logging in', error }, { status: 500 });
  }
}
