import React from "react";
import styles from "./TwoColumnLayout.module.css";

/**
 * TwoColumnLayout - A flexible, responsive two-column layout component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.left - Content for the left column
 * @param {React.ReactNode} props.right - Content for the right column
 * @param {string} props.leftRatio - Width ratio for left column (default: "65")
 * @param {string} props.rightRatio - Width ratio for right column (default: "35")
 * @param {'left'|'right'|'none'} props.sticky - Which column should be sticky (default: "right")
 * @param {string} props.gap - Gap between columns in rem (default: "2")
 * @param {number} props.stackBreakpoint - Breakpoint in px where columns stack (default: 992)
 * @param {'left-first'|'right-first'} props.mobileOrder - Order on mobile (default: "left-first")
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.leftLabel - Accessible label for left column
 * @param {string} props.rightLabel - Accessible label for right column
 */
export default function TwoColumnLayout({
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
}) {
  // Build dynamic style variables
  const layoutStyle = {
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
    <div className={layoutClasses} style={layoutStyle}>
      <div className={styles.leftColumn} aria-label={leftLabel}>
        {left}
      </div>
      <div className={styles.rightColumn} aria-label={rightLabel}>
        {right}
      </div>
    </div>
  );
}
