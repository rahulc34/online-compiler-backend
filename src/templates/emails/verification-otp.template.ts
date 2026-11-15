import { escapeHtml } from "../../utils/html-escape";

interface VerificationOtpTemplateOptions {
  name: string;
  otp: string;
}

export const verificationOtpTemplate = ({
  name,
  otp,
}: VerificationOtpTemplateOptions): string => {
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otp);

  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:30px;background:#f4f4f5;font-family:Arial,sans-serif;">
        <div style="max-width:500px;margin:auto;background:#ffffff;padding:32px;border-radius:12px;">
          <h2 style="color:#18181b;">Verify your email</h2>

          <p style="color:#52525b;">
            Hello ${safeName},
          </p>

          <p style="color:#52525b;">
            Use the verification code below to verify your email address.
          </p>

          <div style="margin:28px 0;text-align:center;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2563eb;">
              ${safeOtp}
            </span>
          </div>

          <p style="color:#71717a;">
            This code expires in 5 minutes.
          </p>

          <p style="color:#71717a;font-size:13px;">
            If you did not request this code, you can ignore this email.
          </p>

          <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />

          <p style="color:#a1a1aa;font-size:12px;">
            Compiler Team
          </p>
        </div>
      </body>
    </html>
  `;
};
