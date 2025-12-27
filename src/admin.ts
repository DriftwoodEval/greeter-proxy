import Database from "better-sqlite3";
import { Command } from "commander";
import { parsePhoneNumberWithError } from "libphonenumber-js";
import * as DB from "./db";

const program = new Command();
const db = new Database("database.sqlite");

program
	.name("sms-admin")
	.description("CLI to manage the Greeter Proxy database")
	.version(require("../package.json").version);

program
	.command("add")
	.description("Add a new user (Greeter or Evaluator)")
	.requiredOption("-p, --phone <number>", "Phone number (e.g., +1555...)")
	.requiredOption("-r, --role <role>", "Role (greeter or evaluator)")
	.requiredOption("-n, --name <name>", "Name of the person")
	.action((options) => {
		try {
			if (options.role !== "greeter" && options.role !== "evaluator") {
				throw new Error('Role must be either "greeter" or "evaluator"');
			}

			const phoneNumber = parsePhoneNumberWithError(options.phone, "US");

			if (!phoneNumber || !phoneNumber.isValid()) {
				throw new Error(`Invalid phone number format: ${options.phone}`);
			}

			const cleanPhone = phoneNumber.number;

			DB.addUser(cleanPhone, options.role, options.name);
			console.log(
				`Successfully added ${options.role}: ${options.name} (${cleanPhone})`,
			);

			// biome-ignore lint/suspicious/noExplicitAny: Could be any error
		} catch (error: any) {
			console.error(`Error: ${error.message}`);
		}
	});

program
	.command("list")
	.description("List all users in the database")
	.action(() => {
		const stmt = db.prepare("SELECT * FROM users ORDER BY role, name");
		const users = stmt.all();
		if (users.length === 0) {
			console.log("No users found");
		} else {
			console.table(users);
		}
	});

program
	.command("remove")
	.description("Remove a user by name or phone humber")
	.argument("<identifier>", "Name or phone number to remove")
	.action((identifier) => {
		const findStmt = db.prepare(`
      SELECT * FROM users
      WHERE phone_number = ?
      OR lower(name) = lower(?)
    `);
		const matches = findStmt.all(identifier, identifier) as DB.User[];

		if (matches.length === 0) {
			console.log(`User not found: "${identifier}"`);
			return;
		}

		if (matches.length > 1) {
			console.log(
				`Ambiguous request. Multiple users found with name "${identifier}":`,
			);
			console.table(matches);
			console.log(
				`Please run the command again using the specific Phone Number.`,
			);
			return;
		}

		const userToDelete = matches[0];
		const deleteStmt = db.prepare("DELETE FROM users WHERE id = ?");
		deleteStmt.run(userToDelete.id);

		console.log(
			`Removed ${userToDelete.role}: ${userToDelete.name} (${userToDelete.phone_number})`,
		);
	});

program
	.command("status")
	.description("Show the current active evaluator conversation")
	.action(() => {
		const stateStmt = db.prepare(
			"SELECT value FROM system_state WHERE key = 'last_active_evaluator'",
		);
		const result = stateStmt.get() as { value: string } | undefined;

		if (!result || !result.value) {
			console.log("System Status: Idle (No active conversation)");
			return;
		}

		const activePhone = result.value;

		const userStmt = db.prepare(
			"SELECT name FROM users WHERE phone_number = ?",
		);
		const user = userStmt.get(activePhone) as { name: string } | undefined;
		const displayName = user ? user.name : "Unknown User";

		console.log(`System Status: Active Conversation`);
		console.log(
			`   Routing Greeter replies to: ${displayName} (${activePhone})`,
		);
	});

program
	.command("reset")
	.description("Force clear the active conversation")
	.action(() => {
		const stmt = db.prepare(
			"DELETE FROM system_state WHERE key = 'last_active_evaluator'",
		);
		stmt.run();
		console.log("Conversation state reset. System is now Idle.");
	});

program.parse();
