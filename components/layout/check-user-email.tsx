"use client";

import { useEffect } from "react";
import { useEmailModal } from "@/hooks/modal-hooks";

type CheckUserEmailProps = {
	user: { email?: string | null } | null | undefined;
};

const CheckUserEmail = ({ user }: CheckUserEmailProps) => {
	const emailModal = useEmailModal();

	useEffect(() => {
		if (!user?.email) {
			emailModal.onOpen();
		}
	}, [user, emailModal]);

	return null;
};

export default CheckUserEmail;
