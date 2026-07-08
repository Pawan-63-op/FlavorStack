const nodemailer = require('nodemailer');

import dotenv from "dotenv";
dotenv.config();

export const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER, // your Gmail
        pass: process.env.SMTP_PASS  // App Password
    }
});

export const sender = `"Demo App" <${process.env.SMTP_USER}>`;
