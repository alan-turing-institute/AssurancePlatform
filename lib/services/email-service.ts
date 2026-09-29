import { EmailClient } from "@azure/communication-email";
import { logger } from "@/lib/logger";
import { escapeHtml } from "../sanitize-html";

const log = logger.child({ component: "email-service" });

// Configuration
const ACS_CONNECTION_STRING = process.env.ACS_CONNECTION_STRING;
const ACS_SENDER_ADDRESS =
	process.env.ACS_SENDER_ADDRESS ||
	"DoNotReply@f6c20413-1d38-4929-b7d6-3e24bd86ad11.azurecomm.net";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const APP_NAME = "TEA Platform";
const TEA_LOGO_URL = `${APP_URL}/images/logos/tea-logo-full-dark.png`;

/**
 * Shared header markup used by every email template: the TEA logo on the
 * dark banner. Hosted (not inline base64) because Gmail does not render
 * data-URI images.
 */
function renderEmailHeader(): string {
	return `
  <div style="background: #1a1f2e; padding: 24px 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <img src="${TEA_LOGO_URL}" alt="${APP_NAME}" style="max-width: 280px; height: auto;">
  </div>
`;
}

// Types
type EmailResult = { data: { messageId: string } } | { error: string };

// Matches a candidate URL in free text, plus any trailing punctuation
// (e.g. the "." that directly follows a link at the end of a sentence) so
// that punctuation can be split off before parsing and reattached after —
// `new URL()` would otherwise fold it into the path/query and reproduce it
// oddly on the way back out.
const URL_WITH_TRAILING_PUNCTUATION_PATTERN = /https?:\/\/\S+/g;
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?)\]}]+$/;
const SENSITIVE_QUERY_KEY_PATTERN = /(token|code|key|secret|otp|signature)$/i;
const TOKEN_LIKE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

/** `…` plus the last 4 characters of `value`, whatever its length or charset. */
function redactValue(value: string): string {
	return `…${value.slice(-4)}`;
}

/**
 * Redacts sensitive values inside one URL, without touching the scheme or
 * host:
 * - a query parameter whose key ends in token/code/key/secret/otp/signature
 *   (case-insensitive) has its whole value replaced — regardless of length
 *   or charset, so a 6-digit code and a base64 token are covered exactly
 *   like a 64-hex token;
 * - the final path segment is redacted only when it is itself at least 16
 *   `[A-Za-z0-9_-]` characters (e.g. `/verify/<token>`), so an ordinary
 *   path like `/reset-password` is left alone.
 * A URL that fails to parse is returned unchanged rather than guessed at.
 *
 * Rebuilds the query/path strings by hand rather than reassigning
 * `parsed.search`/`parsed.pathname` and calling `.toString()`: this is a log
 * line for a human, not a link to be clicked, and `URL`'s own serialiser
 * percent-encodes the "…" marker into `%E2%80%A6`, which defeats the point
 * of a readable redaction. `URL` is still what does the parsing — origin,
 * path segments, query keys/values — only the redacted output is written
 * out literally.
 */
function redactUrl(rawUrl: string): string {
	const trailingMatch = rawUrl.match(TRAILING_PUNCTUATION_PATTERN);
	const trailing = trailingMatch?.[0] ?? "";
	const urlPart = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;

	let parsed: URL;
	try {
		parsed = new URL(urlPart);
	} catch {
		return rawUrl;
	}

	const query = [...parsed.searchParams.entries()]
		.map(([key, value]) =>
			SENSITIVE_QUERY_KEY_PATTERN.test(key) && value
				? `${key}=${redactValue(value)}`
				: `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
		)
		.join("&");

	const segments = parsed.pathname.split("/");
	const lastIndex = segments.length - 1;
	const lastSegment = segments[lastIndex];
	if (lastSegment && TOKEN_LIKE_PATH_SEGMENT_PATTERN.test(lastSegment)) {
		segments[lastIndex] = redactValue(lastSegment);
	}
	const path = segments.join("/");

	return `${parsed.origin}${path}${query ? `?${query}` : ""}${trailing}`;
}

/**
 * Redacts sensitive values inside every URL found in `content` (see
 * `redactUrl`); text outside a URL — including a token-length word that
 * merely sits in the body copy — is left untouched.
 */
export function redactTokensInUrls(content: string): string {
	return content.replace(URL_WITH_TRAILING_PUNCTUATION_PATTERN, redactUrl);
}

interface PasswordResetEmailParams {
	expiresInMinutes?: number;
	resetToken: string;
	to: string;
	username: string;
}

interface WelcomeEmailParams {
	to: string;
	username: string;
}

interface AccountDeletedEmailParams {
	to: string;
	username: string;
}

interface RetentionWarningEmailParams {
	/** The date deletion will actually happen if the account stays inactive — see the callers in retention-service.ts for how this is computed. */
	deletionDate: Date;
	to: string;
	username: string;
}

/**
 * Get the Azure Communication Services email client.
 * Returns null if not configured (for development/testing).
 */
function getEmailClient(): EmailClient | null {
	if (!ACS_CONNECTION_STRING) {
		// In production this is a misconfiguration, not a dev preview: the
		// email is not "logged only" (sendEmail now fails closed), and
		// sendEmail logs its own "Email provider not configured" error right
		// after this returns — a second, differently-worded warning here
		// would just be noise on top of the log line that actually matters.
		if (process.env.NODE_ENV !== "production") {
			log.warn(
				"ACS_CONNECTION_STRING not configured - emails will be logged only"
			);
		}
		return null;
	}

	return new EmailClient(ACS_CONNECTION_STRING);
}

/**
 * Send an email using Azure Communication Services.
 *
 * When no client is configured (`ACS_CONNECTION_STRING` unset):
 * - In production, this is a misconfiguration, not a dev preview — fail
 *   closed with an error result and log only `to`/`subject`, never the body.
 * - Otherwise (the dev preview), log `to`/`subject` and a redacted form of
 *   the plain-text body: any token-like value inside a URL is replaced by
 *   its last 4 characters, so a reset/verification link is still readable
 *   without the raw token landing in the log stream.
 */
async function sendEmail(
	to: string,
	subject: string,
	htmlContent: string,
	plainTextContent: string
): Promise<EmailResult> {
	const client = getEmailClient();

	if (!client) {
		if (process.env.NODE_ENV === "production") {
			log.error("Email provider not configured", { to, subject });
			return { error: "Email provider not configured" };
		}

		// Development fallback - log a redacted preview, never the raw body
		log.info("Email (development mode)", {
			to,
			subject,
			content: redactTokensInUrls(plainTextContent),
		});
		return { data: { messageId: `dev-${Date.now()}` } };
	}

	try {
		const message = {
			senderAddress: ACS_SENDER_ADDRESS,
			content: {
				subject,
				plainText: plainTextContent,
				html: htmlContent,
			},
			recipients: {
				to: [{ address: to }],
			},
		};

		const poller = await client.beginSend(message);
		const result = await poller.pollUntilDone();

		if (result.status === "Succeeded") {
			return { data: { messageId: result.id } };
		}

		return {
			error: result.error?.message || "Email sending failed",
		};
	} catch (error) {
		log.error("Email sending error", { error });
		return {
			error: error instanceof Error ? error.message : "Unknown email error",
		};
	}
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(
	params: PasswordResetEmailParams
): Promise<EmailResult> {
	const { to, username, resetToken, expiresInMinutes = 60 } = params;
	const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

	const subject = `Reset your ${APP_NAME} password`;

	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  ${renderEmailHeader()}

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1a1f2e; margin-top: 0;">Password Reset Request</h2>

    <p>Hello ${escapeHtml(username)},</p>

    <p>We received a request to reset your password for your ${APP_NAME} account. If you made this request, click the button below to set a new password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: #1a1f2e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        Reset Password
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">This link will expire in ${expiresInMinutes} minutes.</p>

    <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

    <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 30px 0;">

    <p style="color: #999; font-size: 12px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #1a1f2e; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

	const plainTextContent = `
Password Reset Request

Hello ${username},

We received a request to reset your password for your ${APP_NAME} account.

To reset your password, visit the following link:
${resetUrl}

This link will expire in ${expiresInMinutes} minutes.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
${APP_NAME}
`;

	return await sendEmail(to, subject, htmlContent, plainTextContent);
}

/**
 * Send a welcome email to new users.
 */
export async function sendWelcomeEmail(
	params: WelcomeEmailParams
): Promise<EmailResult> {
	const { to, username } = params;
	const loginUrl = `${APP_URL}/login`;

	const subject = `Welcome to ${APP_NAME}!`;

	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  ${renderEmailHeader()}

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1a1f2e; margin-top: 0;">Welcome to ${APP_NAME}!</h2>

    <p>Hello ${escapeHtml(username)},</p>

    <p>Thank you for creating an account with ${APP_NAME}. We're excited to have you on board!</p>

    <p>With ${APP_NAME}, you can:</p>
    <ul>
      <li>Create and manage assurance cases</li>
      <li>Collaborate with your team</li>
      <li>Share and publish your work</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" style="background: #1a1f2e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        Get Started
      </a>
    </div>

    <p>If you have any questions, feel free to reach out to our support team.</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

	const plainTextContent = `
Welcome to ${APP_NAME}!

Hello ${username},

Thank you for creating an account with ${APP_NAME}. We're excited to have you on board!

With ${APP_NAME}, you can:
- Create and manage assurance cases
- Collaborate with your team
- Share and publish your work

Get started: ${loginUrl}

If you have any questions, feel free to reach out to our support team.

---
${APP_NAME}
`;

	return await sendEmail(to, subject, htmlContent, plainTextContent);
}

/**
 * Send an account deletion confirmation email.
 */
export async function sendAccountDeletedEmail(
	params: AccountDeletedEmailParams
): Promise<EmailResult> {
	const { to, username } = params;

	const subject = `Your ${APP_NAME} account has been deleted`;

	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  ${renderEmailHeader()}

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1a1f2e; margin-top: 0;">Account Deleted</h2>

    <p>Hello ${escapeHtml(username)},</p>

    <p>This email confirms that your ${APP_NAME} account has been successfully deleted as requested.</p>

    <p>What this means:</p>
    <ul>
      <li>Your personal data has been removed from our systems</li>
      <li>Any cases you owned have been transferred or deleted</li>
      <li>You will no longer receive emails from us</li>
    </ul>

    <p>If you did not request this deletion, please contact our support team immediately.</p>

    <p>We're sorry to see you go. If you ever want to return, you're always welcome to create a new account.</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

	const plainTextContent = `
Account Deleted

Hello ${username},

This email confirms that your ${APP_NAME} account has been successfully deleted as requested.

What this means:
- Your personal data has been removed from our systems
- Any cases you owned have been transferred or deleted
- You will no longer receive emails from us

If you did not request this deletion, please contact our support team immediately.

We're sorry to see you go. If you ever want to return, you're always welcome to create a new account.

---
${APP_NAME}
`;

	return await sendEmail(to, subject, htmlContent, plainTextContent);
}

function formatRetentionDate(date: Date): string {
	return date.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

/**
 * Send the 30-day inactive-account deletion warning.
 * Copy approved by Chris, 2026-09-07 (verbatim; only the HTML wrapper is ours).
 */
export async function sendRetentionWarningEmail(
	params: RetentionWarningEmailParams
): Promise<EmailResult> {
	const { to, username, deletionDate } = params;
	const loginUrl = `${APP_URL}/login`;
	const formattedDate = formatRetentionDate(deletionDate);

	const subject = `Your ${APP_NAME} account is scheduled for deletion`;

	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  ${renderEmailHeader()}

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1a1f2e; margin-top: 0;">Your account is scheduled for deletion</h2>

    <p>Hello ${escapeHtml(username)},</p>

    <p>You have not logged in to the ${APP_NAME} for two years. Under our data retention policy, your account is scheduled for deletion on ${formattedDate}.</p>

    <p>To keep your account, log in before that date: <a href="${loginUrl}">${loginUrl}</a>. Logging in cancels the deletion.</p>

    <p>If you do nothing, this is what happens on ${formattedDate}:</p>

    <ul>
      <li>Your profile and login details are deleted permanently.</li>
      <li>Each case you created is handled in one of two ways. If another person has Admin access to the case, the case is kept and they become responsible for it. If nobody else has Admin access, the case is deleted, and anyone you shared it with loses access.</li>
      <li>Your name is removed from any comments you left on cases that are kept.</li>
    </ul>

    <p>If you want a copy of your work, log in and export your cases before ${formattedDate}.</p>

    <p>You will receive one final reminder seven days before the deletion date.</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

	const plainTextContent = `
Hello ${username},

You have not logged in to the ${APP_NAME} for two years. Under our data retention policy, your account is scheduled for deletion on ${formattedDate}.

To keep your account, log in before that date: ${loginUrl}. Logging in cancels the deletion.

If you do nothing, this is what happens on ${formattedDate}:

- Your profile and login details are deleted permanently.
- Each case you created is handled in one of two ways. If another person has Admin access to the case, the case is kept and they become responsible for it. If nobody else has Admin access, the case is deleted, and anyone you shared it with loses access.
- Your name is removed from any comments you left on cases that are kept.

If you want a copy of your work, log in and export your cases before ${formattedDate}.

You will receive one final reminder seven days before the deletion date.

---
${APP_NAME}
`;

	return await sendEmail(to, subject, htmlContent, plainTextContent);
}

/**
 * Send the final 7-day inactive-account deletion reminder.
 * Copy approved by Chris, 2026-09-07 (verbatim; only the HTML wrapper is ours).
 */
export async function sendRetentionFinalReminderEmail(
	params: RetentionWarningEmailParams
): Promise<EmailResult> {
	const { to, username, deletionDate } = params;
	const loginUrl = `${APP_URL}/login`;
	const formattedDate = formatRetentionDate(deletionDate);

	const subject = `Final reminder: your ${APP_NAME} account will be deleted in 7 days`;

	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  ${renderEmailHeader()}

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1a1f2e; margin-top: 0;">Final reminder</h2>

    <p>Hello ${escapeHtml(username)},</p>

    <p>This is a follow-up to our earlier warning. Your ${APP_NAME} account has still not been used, and it will be permanently deleted on ${formattedDate}, seven days from now.</p>

    <p>To keep your account, log in before that date: <a href="${loginUrl}">${loginUrl}</a>. Logging in cancels the deletion.</p>

    <p>If you do nothing, your profile and login details will be deleted and cannot be recovered. Cases you created will be kept only where another person has Admin access to them; otherwise they will be deleted and anyone you shared them with will lose access. Your name will be removed from any comments on cases that are kept.</p>

    <p>If you want a copy of your work, log in and export your cases now.</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

	const plainTextContent = `
Hello ${username},

This is a follow-up to our earlier warning. Your ${APP_NAME} account has still not been used, and it will be permanently deleted on ${formattedDate}, seven days from now.

To keep your account, log in before that date: ${loginUrl}. Logging in cancels the deletion.

If you do nothing, your profile and login details will be deleted and cannot be recovered. Cases you created will be kept only where another person has Admin access to them; otherwise they will be deleted and anyone you shared them with will lose access. Your name will be removed from any comments on cases that are kept.

If you want a copy of your work, log in and export your cases now.

---
${APP_NAME}
`;

	return await sendEmail(to, subject, htmlContent, plainTextContent);
}
