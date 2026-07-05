import SettingsNav from "../_components/settings-nav";
import { IntegrationsSection } from "./_components/integrations-section";

const IntegrationsSettings = () => {
	return (
		<main>
			<h1 className="sr-only">Integrations</h1>

			<header className="border-white/5 border-b">
				{/* Secondary navigation */}
				<SettingsNav />
			</header>

			<IntegrationsSection />
		</main>
	);
};

export default IntegrationsSettings;
