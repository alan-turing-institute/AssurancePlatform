import type React from "react";
import CookieConsent from "@/components/layout/cookie-consent";
import Header from "./_components/header";
import PreviewBanner from "./_components/preview-banner";

const LandingLayout = ({ children }: { children: React.ReactNode }) => (
	<>
		<Header />
		{children}
		<PreviewBanner />
		<CookieConsent />
	</>
);

export default LandingLayout;
