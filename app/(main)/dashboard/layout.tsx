import { redirect } from "next/navigation";
import { Navbar } from "@/components/navigation/navbar";
import { validateSession } from "@/lib/auth/validate-session";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await validateSession();
	if (!session) {
		redirect("/login");
	}

	return <Navbar>{children}</Navbar>;
}
