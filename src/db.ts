import Database from "better-sqlite3";

const db = new Database("database.sqlite", { verbose: console.log });

// Initialize Tables if they don't exist
const initDb = () => {
	// Users (Evaluators and Greeters)
	db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('evaluator', 'greeter')) NOT NULL,
      name TEXT
    );
  `);

	// App State
	db.exec(`
    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
};

// Data Access Helpers

export interface User {
	id: number;
	phone_number: string;
	role: "evaluator" | "greeter";
	name: string;
}

export const addUser = (
	phone: string,
	role: "evaluator" | "greeter",
	name: string,
) => {
	const stmt = db.prepare(
		"INSERT OR IGNORE INTO users (phone_number, role, name) VALUES (?, ?, ?)",
	);
	stmt.run(phone, role, name);
};

export const getUserByPhone = (phone: string): User | undefined => {
	const stmt = db.prepare("SELECT * FROM users WHERE phone_number = ?");
	return stmt.get(phone) as User | undefined;
};

export const getAllGreeters = (): User[] => {
	const stmt = db.prepare("SELECT * FROM users WHERE role = 'greeter'");
	return stmt.all() as User[];
};

export const setLastActiveEvaluator = (phone: string) => {
	const stmt = db.prepare(
		"INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)",
	);
	stmt.run("last_active_evaluator", phone);
};

export const getLastActiveEvaluator = (): string | null => {
	const stmt = db.prepare(
		"SELECT value FROM system_state WHERE key = 'last_active_evaluator'",
	);
	const result = stmt.get() as { value: string } | undefined;
	return result ? result.value : null;
};

// Initialize on load
initDb();
