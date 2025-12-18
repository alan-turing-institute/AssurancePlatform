import type React from "react";
import styles from "./TwoColumnLayout.module.css";

type StickyOption = "left" | "right" | "none";
type MobileOrder = "left-first" | "right-first";

type TwoColumnLayoutProps = {
	left: React.ReactNode;
	right: React.ReactNode;
	leftRatio?: string;
	rightRatio?: string;
	sticky?: StickyOption;
	gap?: string;
	stackBreakpoint?: number;
	mobileOrder?: MobileOrder;
	className?: string;
	leftLabel?: string;
	rightLabel?: string;
};

type LayoutStyle = {
	"--left-width": string;
	"--right-width": string;
	"--column-gap": string;
	"--stack-breakpoint": string;
};

/**
 * TwoColumnLayout - A flexible, responsive two-column layout component
 */
const TwoColumnLayout = ({
	left,
	right,
	leftRatio = "65",
	rightRatio = "35",
	sticky = "right",
	gap = "2",
	stackBreakpoint = 992,
	mobileOrder = "left-first",
	className = "",
	leftLabel = "Main content",
	rightLabel = "Sidebar content",
}: TwoColumnLayoutProps): React.ReactNode => {
	// Build dynamic style variables
	const layoutStyle: LayoutStyle = {
		"--left-width": `${leftRatio}%`,
		"--right-width": `${rightRatio}%`,
		"--column-gap": `${gap}rem`,
		"--stack-breakpoint": `${stackBreakpoint}px`,
	};

	// Build class names
	const layoutClasses = [
		styles.twoColumnLayout,
		sticky === "left" ? styles.stickyLeft : "",
		sticky === "right" ? styles.stickyRight : "",
		mobileOrder === "right-first" ? styles.rightFirst : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={layoutClasses} style={layoutStyle as React.CSSProperties}>
			<section aria-label={leftLabel} className={styles.leftColumn}>
				{left}
			</section>
			<section aria-label={rightLabel} className={styles.rightColumn}>
				{right}
			</section>
		</div>
	);
};

export default TwoColumnLayout;
