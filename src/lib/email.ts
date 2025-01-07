// utils/email.ts
// import nodemailer from 'nodemailer';

// const transporter = nodemailer.createTransport({
//   service: 'Gmail',
//   auth: {
//     user: process.env.EMAIL_USER, // Your email
//     pass: process.env.EMAIL_PASS, // Your email password or app password
//   },
// });

// export const sendVerificationEmail = async (email: string, token: string) => {
//   const verificationLink = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/verify-email?token=${token}`;
//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: email,
//     subject: 'Email Verification',
//     text: `Please verify your email by clicking the following link: ${verificationLink}`,
//     html: `<p>Please verify your email by clicking the following link:</p><a href="${verificationLink}">${verificationLink}</a>`,
//   };

//   await transporter.sendMail(mailOptions);
// };

// export const sendPasswordResetEmail = async (email: string, token: string) => {
//     const resetLink = `${process.env.NEXT_PUBLIC_BASE_URL}/auth/reset-password?token=${token}`;
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'Password Reset',
//       text: `Please reset your password by clicking the following link: ${resetLink}`,
//       html: `<p>Please reset your password by clicking the following link:</p><a href="${resetLink}">${resetLink}</a>`,
//     };
  
//     await transporter.sendMail(mailOptions);
//   };
  

// utils/email.ts
// utils/email.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Configure the SES client
const client = new SESClient({
  region: "us-east-1", // Specify your AWS region
  // Optional: If you want to specify credentials programmatically
  // credentials: {
  //   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  //   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  // },
});

export const sendVerificationEmail = async (email: string, userId: string, token: string, settings?:boolean) => {
  let verificationLink
  if(settings){
     verificationLink = `https://agents.genesiss.tech/api/settings/verify-email?userId=${userId}&token=${token}&email=${email}`;
  }else{
     verificationLink = `https://agents.genesiss.tech/api/auth/verify-email?userId=${userId}&token=${token}&email=${email}`;
  }

  const command = new SendEmailCommand({
    Source: 'noreply@genesiss.tech',
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: "Genesiss Search Email Verification",
      },
      Body: {
        Html: {
          Data: `<p>Thank you for signing up for Genesiss Agents! Please verify your email by clicking the following link:</p><a href="${verificationLink}">${verificationLink}</a>`,
        },
        Text: {
          Data: `Please verify your email by clicking the following link: ${verificationLink}`,
        },
      },
    },
  });

  try {
    const response = await client.send(command);
    console.log("Verification email sent:", response.MessageId);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
};


export const sendPasswordResetEmail = async (email: string, userID: string, token: string) => {
  const resetLink = `https://agents.genesiss.tech/api/auth/reset-password?token=${token}&userId=${userID}&email=${email}`;

  const input = {
    Source: 'noreply@genesiss.tech', // Verified sender email
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: "Password Reset",
      },
      Body: {
        Html: {
          Data: `<p>Please reset your password by clicking the following link:</p><a href="${resetLink}">${resetLink}</a>`,
        },
        Text: {
          Data: `Please reset your password by clicking the following link: ${resetLink}`,
        },
      },
    },
    // Optional fields
    // ReplyToAddresses: ["reply-to@example.com"],
    // Tags: [
    //   {
    //     Name: "Purpose",
    //     Value: "PasswordReset",
    //   },
    // ],
  };

  try {
    const command = new SendEmailCommand(input);
    const response = await client.send(command);
    console.log(response)
    console.log("Password reset email sent:", response.MessageId);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
};
