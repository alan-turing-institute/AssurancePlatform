import SettingsNav from "../_components/settings-nav";
import { PluginsSection } from "./_components/plugins-section";

const PluginsSettings = () => {
	return (
		<main>
			<h1 className="sr-only">Plugins</h1>

			<header className="border-white/5 border-b">
				{/* Secondary navigation */}
				<SettingsNav />
			</header>

			<PluginsSection />
		</main>
	);
};

export default PluginsSettings;
