import { escapeHtml } from "../../utils/html-escape";

interface PasswordResetTemplateOptions {
  name: string;
  resetUrl: string;
}

export const passwordResetTemplate = ({
  name,
  resetUrl,
}: PasswordResetTemplateOptions): string => {
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);
  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:30px;background:#f4f4f5;font-family:Arial,sans-serif;">
        <div style="max-width:500px;margin:auto;background:#ffffff;padding:32px;border-radius:12px;">
          <h2 style="color:#18181b;">Reset your password</h2>

          <p style="color:#52525b;">
            Hello ${safeName},
          </p>

          <p style="color:#52525b;">
            We received a request to reset your Compiler account password.
          </p>

          <div style="margin:28px 0;text-align:center;">
            <a
              href="${safeResetUrl}"
              style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;"
            >
              Reset Password
            </a>
          </div>

          <p style="color:#71717a;">
            This link expires in 15 minutes.
          </p>

          <p style="color:#71717a;font-size:13px;">
            If you did not request a password reset, ignore this email.
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
