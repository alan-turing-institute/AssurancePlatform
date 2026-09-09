import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Privacy Policy | TEA Platform",
};

const PrivacyPolicyPage = () => {
	return (
		<div className="bg-background px-6 py-32 lg:px-8">
			<div className="mx-auto max-w-3xl text-base/7 text-muted-foreground">
				<h1 className="mt-2 text-pretty font-semibold text-4xl text-foreground tracking-tight sm:text-5xl">
					Privacy Notice for the Trustworthy and Ethical Assurance Platform
				</h1>
				<p className="mt-6 text-xl/8">
					This notice explains what personal data the Trustworthy and Ethical
					Assurance (TEA) Platform (&quot;we&quot;, &quot;us&quot;) collects,
					why, how long we keep it, and how you can remove it. The Platform is
					provided by The Alan Turing Institute{" "}
					<strong>
						[Chris: confirm the Institute is the data controller and whether to
						link the Institute&apos;s own privacy notice]
					</strong>
					. Contact: tea@turing.ac.uk.
				</p>

				<div className="mt-16 max-w-3xl">
					<h2 className="text-pretty font-semibold text-3xl text-foreground tracking-tight">
						What we collect
					</h2>
					<ul className="mt-6 ml-8 max-w-xl list-disc text-muted-foreground">
						<li>
							<em>Account details.</em> Your email address, a username, and
							optionally your first name, last name and a profile picture. If
							you register with a password, we store a hash of it, never the
							password itself.
						</li>
						<li>
							<em>Sign-in identifiers.</em> If you sign in with GitHub or
							Google, we store the identifier and email address that provider
							gives us so we can recognise you next time.
						</li>
						<li>
							<em>Google Drive access tokens.</em> If you connect Google Drive,
							we store the access and refresh tokens Google issues so the
							Platform can act on your Drive on your behalf (see &quot;Google
							user data&quot; below).
						</li>
						<li>
							<em>Your content.</em> The assurance cases you create, their
							elements, comments, and any evidence files you upload. If you
							publish a case to Discover, its content is public.
						</li>
						<li>
							<em>Activity and security records.</em> The time of your most
							recent login, and a security log of sign-in and account events
							that records the action, the time, your IP address and your
							browser type. We use this to detect misuse and to investigate
							security incidents.
						</li>
						<li>
							<em>Emails we send you.</em> Account emails (welcome, password
							reset, account deletion, and the inactivity warnings described in
							the retention policy) are sent through Microsoft Azure
							Communication Services.
						</li>
					</ul>
					<p className="mt-6">
						We use only essential cookies, for signing you in and keeping your
						session. See the{" "}
						<Link className="text-primary underline" href="/cookie-policy">
							Cookie Notice
						</Link>
						.
					</p>
				</div>

				<div className="mt-16 max-w-3xl">
					<h2 className="text-pretty font-semibold text-3xl text-foreground tracking-tight">
						Why we use it
					</h2>
					<p className="mt-6">
						To run your account, to let you build and share assurance cases, to
						send the account emails above, and to keep the Platform secure. We
						do not sell personal data, use it for advertising, or share it with
						third parties except the providers that host and deliver the service
						(Microsoft Azure for hosting, storage and email; GitHub and Google
						when you choose to sign in or connect with them).
					</p>
				</div>

				<div className="mt-16 max-w-3xl">
					<h2 className="text-pretty font-semibold text-3xl text-foreground tracking-tight">
						Google user data
					</h2>
					<p className="mt-6">
						When you connect Google, we ask for the <code>drive.file</code>{" "}
						permission. This lets the Platform see, create and change{" "}
						<strong>
							only the files it creates in your Drive, or that you open with it
						</strong>
						. It does not give us access to the rest of your Drive. We use it to
						create a TEA folder in your Drive and to save exports of your cases
						there when you ask, and to read back files you have chosen to link
						to a case.
					</p>
					<p className="mt-6">
						The tokens are stored in our database and sent only over encrypted
						connections. We use them only to make the Drive requests you
						trigger. We do not use Google user data for advertising, do not sell
						it, and do not let humans read it except with your permission, for
						security purposes, or to comply with the law. Our use of information
						received from Google APIs adheres to the{" "}
						<a
							className="text-primary underline"
							href="https://developers.google.com/terms/api-services-user-data-policy"
							rel="noopener noreferrer"
							target="_blank"
						>
							Google API Services User Data Policy
						</a>
						, including the Limited Use requirements.
					</p>
					<p className="mt-6">
						You can disconnect Google at any time from{" "}
						<strong>Settings → Connected accounts</strong>, which deletes the
						stored tokens, or by revoking the Platform&apos;s access from your{" "}
						<a
							className="text-primary underline"
							href="https://myaccount.google.com/permissions"
							rel="noopener noreferrer"
							target="_blank"
						>
							Google account permissions
						</a>
						.
					</p>
				</div>

				<div className="mt-16 max-w-3xl">
					<h2 className="text-pretty font-semibold text-3xl text-foreground tracking-tight">
						How long we keep it
					</h2>
					<p className="mt-6">
						We keep your account and content while you use the Platform. If you
						do not log in for two years we warn you by email 30 days and 7 days
						before deleting the account, and then delete it. The full rules are
						in the{" "}
						<Link
							className="text-primary underline"
							href="/docs/data-retention-policy"
						>
							Data Retention Policy
						</Link>
						.
					</p>
				</div>

				<div className="mt-16 max-w-3xl">
					<h2 className="text-pretty font-semibold text-3xl text-foreground tracking-tight">
						Deleting your data
					</h2>
					<p className="mt-6">
						You can delete your account from <strong>Settings</strong>. When an
						account is deleted: cases you own that have another Admin are kept
						under that Admin; cases with no other Admin are deleted; your name
						is removed from comments on cases that are kept; your account
						details, sign-in identifiers and tokens are deleted. If you own any
						integrations you must remove them first.
					</p>
				</div>

				<div className="mt-16 max-w-3xl">
					<h2 className="text-pretty font-semibold text-3xl text-foreground tracking-tight">
						Where it is stored
					</h2>
					<p className="mt-6">
						The Platform runs on Microsoft Azure{" "}
						<strong>
							[Chris: region — UK South? — confirm before stating]
						</strong>
						.
					</p>
				</div>

				<div className="mt-16 max-w-3xl">
					<h2 className="text-pretty font-semibold text-3xl text-foreground tracking-tight">
						Changes and questions
					</h2>
					<p className="mt-6">
						We will update this notice when the Platform&apos;s data handling
						changes and show the date of the last change here. Questions:
						tea@turing.ac.uk.
					</p>
				</div>

				<div className="mt-16 max-w-3xl">
					<p className="mt-6 italic">Last updated: September 2026</p>
				</div>
			</div>
		</div>
	);
};

export default PrivacyPolicyPage;
