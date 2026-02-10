// import { transporter, sender } from  MailtrapClient
import { transporter,sender } from "./mailer";
import { generatePasswordResetEmailHtml, generateResetSuccessEmailHtml, generateWelcomeEmailHtml, htmlContent as templateHtml } from "./htmlEmail";

// Verification Email
export const sendVerificationEmail = async (email: string, verificationToken: string) => {
    const html = templateHtml.replace("{verificationToken}", verificationToken);

    try {
        // await transporter.sendMail({
        //     from: sender,
        //     to: email,
        //     subject: "Verify your email",
        //     html: html
        // });
        console.log(`✅ Verification email sent to ${email}`);
    } catch (error) {
        console.error(error);
        throw new Error("Failed to send email verification");
    }
};

// Welcome Email
export const sendWelcomeEmail = async (email: string, name: string) => {
    const html = generateWelcomeEmailHtml(name);

    try {
        await transporter.sendMail({
            from: sender,
            to: email,
            subject: "Welcome to Pawan_op",
            html: html
        });
        console.log(`✅ Welcome email sent to ${email}`);
    } catch (error) {
        console.error(error);
        throw new Error("Failed to send welcome email");
    }
};

// Password Reset Email
export const sendPasswordResetEmail = async (email: string, resetURL: string) => {
    const html = generatePasswordResetEmailHtml(resetURL);

    try {
        await transporter.sendMail({
            from: sender,
            to: email,
            subject: "Reset your password",
            html: html
        });
        console.log(`✅ Password reset email sent to ${email}`);
    } catch (error) {
        console.error(error);
        throw new Error("Failed to send password reset email");
    }
};

// Reset Success Email

export const sendResetSuccessEmail = async (email: string) => {
    const html = generateResetSuccessEmailHtml();

    try {
        await transporter.sendMail({
            from: sender,
            to: email,
            subject: "Password Reset Successfully",
            html: html
        });
        console.log(`✅ Password reset success email sent to ${email}`);
    } catch (error) {
        console.error(error);
        throw new Error("Failed to send password reset success email");
    }
};
