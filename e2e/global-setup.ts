import { execSync } from "node:child_process";
import { runE2eDatabaseReset } from "../scripts/e2e-database-reset";

export default function globalSetup() {
	runE2eDatabaseReset(process.env, execSync);
}
