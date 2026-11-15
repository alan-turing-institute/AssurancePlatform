import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamMemberList } from "../team-member-list";

vi.mock("next-auth/react", () => ({
	useSession: () => ({ data: { user: { id: "u1" } } }),
}));

const MEMBER_EMAIL = "member.person@example.org";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("TeamMemberList avatars", () => {
	it("loads no image whose address carries a member's email, and shows initials", () => {
		const requestedSrcs: string[] = [];
		class RecordingImage {
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			addEventListener() {
				// Radix registers load listeners; none is needed here.
			}
			removeEventListener() {
				// Paired with addEventListener above.
			}
			set src(value: string) {
				requestedSrcs.push(value);
			}
		}
		vi.stubGlobal("Image", RecordingImage);

		render(
			<TeamMemberList
				currentUserId="u1"
				currentUserRole="MEMBER"
				members={[
					{
						id: "m1",
						role: "MEMBER",
						user: { id: "u2", username: "Mia Member", email: MEMBER_EMAIL },
					},
				]}
				teamId="t1"
			/>
		);

		expect(screen.getByText("MM")).toBeVisible();
		for (const src of requestedSrcs) {
			expect(src).not.toContain(MEMBER_EMAIL);
			expect(src).not.toContain("avatar.vercel.sh");
		}
	});
});
