import { redirect } from "next/navigation";
import { fetchConnectedAccounts } from "@/actions/connected-accounts";
import { fetchCurrentUser } from "@/actions/users";
import { validateSession } from "@/lib/auth/validate-session";
import { ConnectedAccountsForm } from "./_components/connected-accounts-form";
import { DeleteForm } from "./_components/delete-form";
import { PasswordForm } from "./_components/password-form";
import { PersonalInfoForm } from "./_components/personal-info-form";

const SettingsPage = async () => {
	const session = await validateSession();
	if (!session) {
		redirect("/login");
	}

	const [currentUser, connectedAccounts] = await Promise.all([
		fetchCurrentUser(""),
		fetchConnectedAccounts(),
	]);

	return (
		<main>
			<h1 className="sr-only">Account Settings</h1>
			{/* <header className="border-b border-foreground/500">
        <SettingsNav />
      </header> */}
			<div className="min-h-screen divide-y divide-foreground/5">
				<PersonalInfoForm data={currentUser} />
				<ConnectedAccountsForm data={connectedAccounts} />
				<PasswordForm data={currentUser} />
				<DeleteForm user={currentUser} />
			</div>
		</main>
	);
};

export default SettingsPage;
