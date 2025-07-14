import {
  CheckCircleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid';
import React from 'react';

const CookiePolicyPage = () => {
  return (
    <div className="bg-white px-6 py-32 lg:px-8">
      <div className="mx-auto max-w-3xl text-base/7 text-gray-700">
        {/* <p className="text-base/7 font-semibold text-indigo-600">Policy</p> */}
        <h1 className="mt-2 text-pretty font-semibold text-4xl text-gray-900 tracking-tight sm:text-5xl">
          Cookie Notice for the Trustworthy and Ethical Assurance Platform
        </h1>
        <p className="mt-6 text-xl/8">
          This Cookie Notice explains how the Trustworthy and Ethical Assurance
          (TEA) Platform (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
          uses cookies on our website,{' '}
          <a
            className="text-indigo-600 underline"
            href="https://assuranceplatform.azurewebsites.net/"
          >
            https://assuranceplatform.azurewebsites.net/
          </a>{' '}
          (the &quot;Platform&quot;). This notice is designed to help you
          understand what cookies are, why we use them, and your choices
          regarding their use.
        </p>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-pretty font-semibold text-3xl text-gray-900 tracking-tight">
            What are Cookies?
          </h2>
          <p className="mt-6">
            Cookies are small text files that are stored on your computer or
            mobile device by your web browser when you visit a website. They are
            widely used to make websites work, or work more efficiently, as well
            as to provide information to the website owners.
          </p>
        </div>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-pretty font-semibold text-3xl text-gray-900 tracking-tight">
            How We Use Cookies
          </h2>
          <p className="mt-6">
            The TEA Platform uses cookies{' '}
            <strong>exclusively for essential functionalities</strong>. These
            cookies are strictly necessary for the operation of our Platform,
            particularly for user authentication and session management. Without
            these cookies, registered users would not be able to log in and
            access the core features of the TEA Platform securely.
          </p>
          <p className="mt-6">
            We do <strong>not</strong> use cookies for:
          </p>
          <ul className="mt-8 max-w-xl space-y-4 text-gray-600" role="list">
            <li className="flex gap-x-3">
              <XCircleIcon
                aria-hidden="true"
                className="mt-1 size-5 flex-none text-rose-600"
              />
              <span>
                Tracking your browsing activity across other websites.
              </span>
            </li>
            <li className="flex gap-x-3">
              <XCircleIcon
                aria-hidden="true"
                className="mt-1 size-5 flex-none text-rose-600"
              />
              <span>Marketing or advertising purposes.</span>
            </li>
            <li className="flex gap-x-3">
              <XCircleIcon
                aria-hidden="true"
                className="mt-1 size-5 flex-none text-rose-600"
              />
              <span>Analytics on anonymous users before login.</span>
            </li>
          </ul>
        </div>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-pretty font-semibold text-3xl text-gray-900 tracking-tight">
            Types of Cookies We Use (Essential Cookies)
          </h2>
          <p className="mt-6">
            The following are the essential cookies used by the TEA Platform.
            These are set by NextAuth.js, the authentication library we use:
          </p>
          <ul className="mt-8 max-w-xl space-y-8 text-gray-600" role="list">
            <li className="flex gap-x-3">
              <CheckCircleIcon
                aria-hidden="true"
                className="mt-1 size-5 flex-none text-emerald-600"
              />
              <div>
                <strong className="font-semibold text-gray-900">
                  next-auth.csrf-token
                </strong>
                <ul className="mt-2 space-y-2">
                  <li>
                    <strong className="font-semibold text-gray-900">
                      Purpose:
                    </strong>{' '}
                    Helps protect against Cross-Site Request Forgery (CSRF)
                    attacks, enhancing the security of your interactions with
                    the Platform.
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-900">
                      Duration:
                    </strong>{' '}
                    Session cookie (expires when you close your browser) or for
                    a short, fixed period for security.
                  </li>
                </ul>
              </div>
            </li>
            <li className="flex gap-x-3">
              <CheckCircleIcon
                aria-hidden="true"
                className="mt-1 size-5 flex-none text-emerald-600"
              />
              <div>
                <strong className="font-semibold text-gray-900">
                  next-auth.callback-url
                </strong>
                <ul className="mt-2 space-y-2">
                  <li>
                    <strong className="font-semibold text-gray-900">
                      Purpose:
                    </strong>{' '}
                    Stores the URL the user was trying to access before being
                    redirected to log in. This allows the Platform to redirect
                    you back to your intended page after successful
                    authentication.
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-900">
                      Duration:
                    </strong>{' '}
                    Session cookie (expires when you close your browser).
                  </li>
                </ul>
              </div>
            </li>
            <li className="flex gap-x-3">
              <CheckCircleIcon
                aria-hidden="true"
                className="mt-1 size-5 flex-none text-emerald-600"
              />
              <div>
                <strong className="font-semibold text-gray-900">
                  next-auth.session-token
                </strong>
                <ul className="mt-2 space-y-2">
                  <li>
                    <strong className="font-semibold text-gray-900">
                      Purpose:
                    </strong>{' '}
                    Stores your session information, allowing you to stay logged
                    in as you navigate the Platform. This is fundamental for
                    accessing features available only to registered and
                    authenticated users.
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-900">
                      Duration:
                    </strong>{' '}
                    This is a session cookie that typically persists for the
                    duration of your browsing session or for a pre-defined
                    secure session length to keep you logged in.
                  </li>
                </ul>
              </div>
            </li>
          </ul>
          <p className="mt-6 italic">
            Note: The exact names and precise behaviour of these cookies may be
            subject to minor changes by the NextAuth.js library. We will
            endeavor to keep this notice updated with significant changes.
          </p>
        </div>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-pretty font-semibold text-3xl text-gray-900 tracking-tight">
            Why These Cookies Are Essential
          </h2>
          <p className="mt-6">
            These cookies are classified as &quot;strictly necessary&quot;
            because:
          </p>
          <ul className="mt-6 ml-8 max-w-xl list-disc text-gray-600">
            <li>
              They enable you to log in and access secure areas of the Platform.
            </li>
            <li>
              They help maintain the security and integrity of your session.
            </li>
            <li>
              The Platform cannot provide the authenticated services you request
              without them.
            </li>
          </ul>
        </div>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-pretty font-semibold text-3xl text-gray-900 tracking-tight">
            Your Choices Regarding Cookies
          </h2>
          <p className="mt-6">
            When you first visit our Platform, you will see a cookie banner
            informing you about our use of essential cookies.
          </p>
          <p className="mt-6">
            Because the cookies we use are strictly necessary for registered
            users to log in and use the Platform&apos;s features:
          </p>
          <ul className="mt-6 ml-8 max-w-xl list-disc text-gray-600">
            <li>
              <strong>
                You cannot opt-out of these essential cookies if you wish to log
                in and use the authenticated sections of the TEA Platform.
              </strong>
            </li>
            <li>
              If you do not wish for these cookies to be placed on your device,
              you can choose not to register or log in to the Platform.
            </li>
            <li>
              You can always manage or delete cookies through your browser
              settings. However, please be aware that if you block or delete our
              essential cookies, you will not be able to log in or use certain
              parts of the Platform. Instructions for managing cookies in
              popular browsers can typically be found in the browser&apos;s
              &quot;Help&quot; section or by searching online.
            </li>
          </ul>
        </div>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-pretty font-semibold text-3xl text-gray-900 tracking-tight">
            Data Protection and GDPR Compliance
          </h2>
          <p className="mt-6">
            We are committed to protecting your privacy and complying with data
            protection laws, including the General Data Protection Regulation
            (GDPR) and UK data protection laws.
          </p>
          <p className="mt-6">
            The use of strictly necessary cookies, such as those for
            authentication and security, is permissible under GDPR (Article
            6(1)(b) - processing is necessary for the performance of a contract
            to which the data subject is party, or Art. 6(1)(f) legitimate
            interest, balanced with user rights). We provide this notice to
            ensure transparency about their use.
          </p>
        </div>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-pretty font-semibold text-3xl text-gray-900 tracking-tight">
            Third-Party Cookies
          </h2>
          <p className="mt-6">
            Currently, the TEA Platform itself primarily uses the first-party
            essential cookies listed above for its core authentication
            functionality.
          </p>
          <p className="mt-6">
            If you choose to authenticate using a third-party provider (e.g.,
            GitHub), that provider will set its own cookies as part of their
            authentication process. These cookies are governed by the respective
            third-party&apos;s cookie policy, which you should review. The TEA
            Platform does not control these third-party cookies once you are on
            their domain for authentication.
          </p>
        </div>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-pretty font-semibold text-3xl text-gray-900 tracking-tight">
            Changes to This Cookie Notice
          </h2>
          <p className="mt-6">
            We may update this Cookie Notice from time to time to reflect
            changes in our practices or for other operational, legal, or
            regulatory reasons. We encourage you to review this notice
            periodically to stay informed about how we use cookies.
          </p>
        </div>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-pretty font-semibold text-3xl text-gray-900 tracking-tight">
            Contact Us
          </h2>
          <p className="mt-6">
            If you have any questions about our use of cookies or this Cookie
            Notice, please raise an issue via our GitHub repository:{' '}
            <a
              className="text-indigo-600 underline"
              href=" https://github.com/alan-turing-institute/AssurancePlatform/issues"
            >
              https://github.com/alan-turing-institute/AssurancePlatform/issues
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicyPage;
