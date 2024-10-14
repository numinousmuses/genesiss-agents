// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dynamoDB } from '@/lib/dynamo';
import { v4 as uuidv4 } from 'uuid';
import { UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { sendPasswordResetEmail } from '@/lib/email';
import { Resource } from 'sst';
import { hashEmail, hashPassword } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const newPasswordHash = hashPassword(password);


  try {
    // Find the user by email
    const result = await dynamoDB.send(new QueryCommand({
      TableName: Resource.FinalUsersTable.name,
      IndexName: hashEmail(email), // Ensure this index exists
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
    }));

    if (!result.Items || result.Items.length === 0) {
      return NextResponse.json({ message: 'Email not found' }, { status: 404 });
    }

    const user = result.Items[0];
    const resetToken = uuidv4();

    // Update the user with the reset token
    // Update the user with the reset token and hashed password
    await dynamoDB.send(new UpdateCommand({
      TableName: Resource.FinalUsersTable.name,
      Key: { userId: user.userId },
      UpdateExpression: 'set resetToken = :resetToken, newHashedPassword = :hashedPassword',
      ExpressionAttributeValues: {
        ':resetToken': resetToken,
        ':hashedPassword': newPasswordHash, // Add the hashedPassword value here
      },
    }));


    // Send the password reset email
    await sendPasswordResetEmail(email, hashEmail(email), resetToken);

    return NextResponse.json({ message: 'Password reset email sent' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Error processing request', error }, { status: 500 });
  }
}
