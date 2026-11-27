/**
 * Error text the credentials sign-in sends back when sign-in is paused for a
 * name or address. It is followed by a colon and the whole minutes to wait,
 * for example `SignInRateLimited:5`, and the sign-in form turns it into a
 * sentence.
 */
export const SIGN_IN_RATE_LIMITED = "SignInRateLimited";

/**
 * The reason a GitHub or Google sign-in is refused when the provider has not
 * confirmed that the email address belongs to the person. The sign-in
 * callback sends the person to `/login?error=EmailNotVerified`, and the
 * sign-in form turns it into a sentence.
 */
export const EMAIL_NOT_VERIFIED = "EmailNotVerified";
