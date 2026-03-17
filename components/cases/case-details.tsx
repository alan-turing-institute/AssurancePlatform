"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { AlertModal } from "@/components/modals/alert-modal";
import { Skeleton } from "@/components/ui/skeleton";
import useStore from "@/store/store";
import CaseSheet from "../ui/case-sheet";
import CaseEditForm from "./case-edit-form";

interface CaseDetailsProps {
	isOpen: boolean;
	setOpen: Dispatch<SetStateAction<boolean>>;
}

const CaseDetails = ({ isOpen, setOpen }: CaseDetailsProps) => {
	const [isMounted, setIsMounted] = useState(false);
	const [loading, _setLoading] = useState(false);
	const [unresolvedChanges, setUnresolvedChanges] = useState(false);
	const [alertOpen, setAlertOpen] = useState(false);

	const { assuranceCase } = useStore();

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return (
			<CaseSheet
				description=""
				isOpen={isOpen}
				onChange={() => setOpen(false)}
				onClose={() => setOpen(false)}
				title="Assurance Case"
			>
				<div className="my-6 space-y-4">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-10 w-24" />
				</div>
			</CaseSheet>
		);
	}

	const handleClose = () => {
		setOpen(false);
		setAlertOpen(false);
		setUnresolvedChanges(false);
	};

	const onChange = (_open: boolean) => {
		if (unresolvedChanges) {
			setAlertOpen(true);
		} else {
			handleClose();
		}
	};

	return (
		<CaseSheet
			description={
				"Use this form to update your assurance case name and description."
			}
			isOpen={isOpen}
			onChange={onChange}
			onClose={handleClose}
			title={`${assuranceCase?.permissions === "manage" ? "Update" : ""} Assurance Case`}
		>
			<div className="my-6">
				<CaseEditForm
					onClose={handleClose}
					setUnresolvedChanges={setUnresolvedChanges}
				/>
				<AlertModal
					cancelButtonText={"No, keep editing"}
					confirmButtonText={"Yes, discard changes!"}
					isOpen={alertOpen}
					loading={loading}
					message={
						"You have changes that have not been updated. Would you like to discard these changes?"
					}
					onClose={() => setAlertOpen(false)}
					onConfirm={handleClose}
				/>
			</div>
		</CaseSheet>
	);
};

export default CaseDetails;
