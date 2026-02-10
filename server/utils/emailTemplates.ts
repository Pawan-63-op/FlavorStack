export const getWelcomeEmailTemplate = (name: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Delicious Bites</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 40px 0;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">🍽️ Delicious Bites</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px;">Welcome, ${name}! 🎉</h2>
                  <p style="margin: 0 0 15px; color: #666666; font-size: 16px; line-height: 1.6;">
                    We're thrilled to have you join the Delicious Bites family! Get ready to embark on a culinary adventure like no other.
                  </p>
                  <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                    Here's what you can do:
                  </p>
                  
                  <!-- Features -->
                  <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 10px;">
                        <p style="margin: 0; color: #667eea; font-weight: bold; font-size: 16px;">🍕 Order from Top Restaurants</p>
                        <p style="margin: 5px 0 0; color: #666666; font-size: 14px;">Discover amazing local and international cuisine</p>
                      </td>
                    </tr>
                    <tr><td height="10"></td></tr>
                    <tr>
                      <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 10px;">
                        <p style="margin: 0; color: #667eea; font-weight: bold; font-size: 16px;">⭐ Earn Loyalty Points</p>
                        <p style="margin: 5px 0 0; color: #666666; font-size: 14px;">You've already received 500 bonus points!</p>
                      </td>
                    </tr>
                    <tr><td height="10"></td></tr>
                    <tr>
                      <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                        <p style="margin: 0; color: #667eea; font-weight: bold; font-size: 16px;">👨‍🍳 Try New Recipes</p>
                        <p style="margin: 5px 0 0; color: #666666; font-size: 14px;">Browse our collection of delicious recipes</p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- CTA Button -->
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="center">
                        <a href="${process.env.FRONTEND_URL}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                          Start Ordering Now
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
                  <p style="margin: 0 0 10px; color: #999999; font-size: 14px;">
                    Need help? Contact us at <a href="mailto:support@deliciousbites.com" style="color: #667eea; text-decoration: none;">support@deliciousbites.com</a>
                  </p>
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © 2024 Delicious Bites. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

export const getVerificationEmailTemplate = (name: string, otp: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 40px 0;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">🔐 Verify Your Email</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px; text-align: center;">
                  <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px;">Hello, ${name}!</h2>
                  <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.6;">
                    To complete your registration, please use the verification code below:
                  </p>
                  
                  <!-- OTP Code -->
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="center">
                        <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px 60px; border-radius: 10px; margin: 20px 0;">
                          <p style="margin: 0; color: #ffffff; font-size: 40px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${otp}
                          </p>
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 30px 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                    This code will expire in <strong>10 minutes</strong>.
                  </p>
                  
                  <div style="padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 5px; margin: 20px 0; text-align: left;">
                    <p style="margin: 0; color: #856404; font-size: 14px;">
                      <strong>⚠️ Security Note:</strong> If you didn't request this code, please ignore this email and secure your account.
                    </p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
                  <p style="margin: 0 0 10px; color: #999999; font-size: 14px;">
                    Need help? Contact us at <a href="mailto:support@deliciousbites.com" style="color: #667eea; text-decoration: none;">support@deliciousbites.com</a>
                  </p>
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © 2024 Delicious Bites. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

export const getPasswordResetEmailTemplate = (name: string, resetToken: string): string => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 40px 0;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">🔑 Password Reset</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px;">Hello, ${name}!</h2>
                  <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                    We received a request to reset your password. Click the button below to create a new password:
                  </p>
                  
                  <!-- CTA Button -->
                  <table cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                    Or copy and paste this link into your browser:
                  </p>
                  <p style="margin: 0 0 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; word-break: break-all; font-size: 14px; color: #667eea;">
                    ${resetUrl}
                  </p>
                  
                  <div style="padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0 0 10px; color: #856404; font-size: 14px; font-weight: bold;">
                      ⚠️ Important:
                    </p>
                    <ul style="margin: 0; padding-left: 20px; color: #856404; font-size: 14px;">
                      <li>This link will expire in <strong>1 hour</strong></li>
                      <li>If you didn't request this, please ignore this email</li>
                      <li>Your password won't change until you create a new one</li>
                    </ul>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
                  <p style="margin: 0 0 10px; color: #999999; font-size: 14px;">
                    Need help? Contact us at <a href="mailto:support@deliciousbites.com" style="color: #667eea; text-decoration: none;">support@deliciousbites.com</a>
                  </p>
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © 2024 Delicious Bites. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

export const getResetSuccessEmailTemplate = (name: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Successful</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 40px 0;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 40px 30px; text-align: center;">
                  <div style="width: 80px; height: 80px; background-color: #ffffff; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <span style="font-size: 40px;">✓</span>
                  </div>
                  <h1 style="margin: 0; color: #333333; font-size: 32px; font-weight: bold;">Password Reset Successful!</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px; text-align: center;">
                  <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px;">Hello, ${name}!</h2>
                  <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                    Your password has been successfully reset. You can now log in to your account with your new password.
                  </p>
                  
                  <!-- Success Icon -->
                  <div style="margin: 30px 0;">
                    <div style="display: inline-block; padding: 30px; background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%); border-radius: 50%; box-shadow: 0 4px 15px rgba(132, 250, 176, 0.3);">
                      <span style="font-size: 48px;">🎉</span>
                    </div>
                  </div>
                  
                  <!-- CTA Button -->
                  <table cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                          Log In Now
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <div style="padding: 20px; background-color: #e7f3ff; border-left: 4px solid #2196f3; border-radius: 5px; margin: 20px 0; text-align: left;">
                    <p style="margin: 0 0 10px; color: #0d47a1; font-size: 14px; font-weight: bold;">
                      🔒 Security Tips:
                    </p>
                    <ul style="margin: 0; padding-left: 20px; color: #1565c0; font-size: 14px;">
                      <li>Use a strong, unique password</li>
                      <li>Don't share your password with anyone</li>
                      <li>Enable two-factor authentication if available</li>
                    </ul>
                  </div>
                  
                  <p style="margin: 20px 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                    If you didn't make this change or believe an unauthorized person has accessed your account, please contact us immediately.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
                  <p style="margin: 0 0 10px; color: #999999; font-size: 14px;">
                    Need help? Contact us at <a href="mailto:support@deliciousbites.com" style="color: #667eea; text-decoration: none;">support@deliciousbites.com</a>
                  </p>
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © 2024 Delicious Bites. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};
