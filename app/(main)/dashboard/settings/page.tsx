import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/actions/users";
import { validateSession } from "@/lib/auth/validate-session";
import { DeleteForm } from "./_components/delete-form";
import { PasswordForm } from "./_components/password-form";
import { PersonalInfoForm } from "./_components/personal-info-form";

const SettingsPage = async () => {
	const session = await validateSession();
	if (!session) {
		redirect("/login");
	}

	const currentUser = await fetchCurrentUser("");

	return (
		<main>
			<h1 className="sr-only">Account Settings</h1>
			{/* <header className="border-b border-foreground/500">
        <SettingsNav />
      </header> */}
			<div className="min-h-screen divide-y divide-foreground/5">
				<PersonalInfoForm data={currentUser} />
				<PasswordForm data={currentUser} />
				<DeleteForm user={currentUser} />
			</div>
		</main>
	);
};

export default SettingsPage;
