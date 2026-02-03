"use client";

import useStore from "@/data/store";
import ActionTooltip from "../ui/action-tooltip";

const ActiveUsersList = () => {
	const { activeUsers } = useStore();

	return (
		<div className="mr-6 flex items-center justify-start">
			{activeUsers
				?.filter((user) => user.username)
				.map((user, index: number) => (
					<ActionTooltip key={user.id} label={user.username}>
						<div
							className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-primary bg-background font-semibold text-foreground text-sm uppercase hover:cursor-pointer ${index > 0 ? "-ml-2" : ""}`}
						>
							{user.username.substring(0, 1)}
						</div>
					</ActionTooltip>
				))}
		</div>
	);
};

export default ActiveUsersList;
