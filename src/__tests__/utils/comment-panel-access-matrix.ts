/**
 * What the element comments panel offers at each case permission the case
 * endpoint can send. One table, read by the panel's component tests and by the
 * integration test that runs the same cases against the comment service, so the
 * two cannot drift apart unnoticed.
 */
export const PANEL_PERMISSIONS = ["view", "comment", "edit", "manage"] as const;

export type PanelPermission = (typeof PANEL_PERMISSIONS)[number];

export interface PanelAccess {
	/** The new-comment form is shown. */
	form: boolean;
	/** Resolve is offered on a top-level comment someone else wrote. */
	resolveOthers: boolean;
	/** Resolve is offered on a top-level comment the viewer wrote. */
	resolveOwn: boolean;
}

export const PANEL_ACCESS: Record<PanelPermission, PanelAccess> = {
	view: { form: false, resolveOwn: false, resolveOthers: false },
	comment: { form: true, resolveOwn: true, resolveOthers: false },
	edit: { form: true, resolveOwn: true, resolveOthers: true },
	manage: { form: true, resolveOwn: true, resolveOthers: true },
};

/** The permissions that get action buttons on a comment (everyone but view). */
export const ACTING_PERMISSIONS = ["comment", "edit", "manage"] as const;
