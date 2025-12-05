import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const sql = postgres(connectionString);

async function main() {
	// Find all duplicate email groups
	const duplicates = await sql`
		SELECT
			email,
			array_agg(id ORDER BY id) as user_ids,
			array_agg(username ORDER BY id) as usernames,
			array_agg(auth_provider ORDER BY id) as auth_providers,
			array_agg(last_login ORDER BY id) as last_logins
		FROM api_eapuser
		WHERE email != '' AND email IS NOT NULL
		GROUP BY email
		HAVING COUNT(*) > 1
		ORDER BY email
	`;

	console.log("=".repeat(100));
	console.log("DUPLICATE USER REPORT");
	console.log("=".repeat(100));
	console.log(`Found ${duplicates.length} duplicate email groups\n`);

	for (const group of duplicates) {
		console.log(`\nEmail: ${group.email}`);
		console.log("-".repeat(80));

		// Get detailed info for each user in the group
		for (let i = 0; i < group.user_ids.length; i++) {
			const userId = group.user_ids[i];
			const username = group.usernames[i];
			const authProvider = group.auth_providers[i];
			const lastLogin = group.last_logins[i];

			// Get data counts
			const cases =
				await sql`SELECT COUNT(*) as count FROM api_assurancecase WHERE owner_id = ${userId}`;
			const groups =
				await sql`SELECT COUNT(*) as count FROM api_eapgroup WHERE owner_id = ${userId}`;
			const comments =
				await sql`SELECT COUNT(*) as count FROM api_comment WHERE author_id = ${userId}`;

			const totalData =
				Number(cases[0].count) +
				Number(groups[0].count) +
				Number(comments[0].count);
			let lastLoginStr = "never";
			if (lastLogin) {
				try {
					const date = new Date(lastLogin);
					if (!Number.isNaN(date.getTime())) {
						lastLoginStr = date.toISOString().split("T")[0];
					}
				} catch {
					lastLoginStr = "invalid";
				}
			}

			console.log(
				`  ID ${userId.toString().padStart(3)} | ${username.padEnd(30)} | ${authProvider.padEnd(8)} | Last: ${lastLoginStr.padEnd(10)} | Data: ${totalData} (C:${cases[0].count} G:${groups[0].count} Co:${comments[0].count})`
			);
		}
	}

	console.log(`\n${"=".repeat(100)}`);
	await sql.end();
}

main();
