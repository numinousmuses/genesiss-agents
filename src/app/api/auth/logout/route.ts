// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';

const sessions = new Map<string, { userId: string; email: string; username: string }>();

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('sessionId')?.value;
  
  if (sessionId) {
    sessions.delete(sessionId);
  }

  return NextResponse.json({ message: 'Logged out successfully' }, {
    status: 200,
    headers: {
      'Set-Cookie': 'sessionId=; Path=/; HttpOnly; Max-Age=0',
    },
  });
}

