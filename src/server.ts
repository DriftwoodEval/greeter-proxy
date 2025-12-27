import bodyParser from "body-parser";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import twilio from "twilio";
import * as DB from "./db";

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER || "";
const client = twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN,
);

if (!TWILIO_PHONE) {
	console.error("Missing TWILIO_PHONE_NUMBER in .env");
	process.exit(1);
}

app.post("/sms", async (req: Request, res: Response) => {
	const senderPhone = req.body.From;
	const messageBody = req.body.Body;

	console.log(`Incoming from ${senderPhone}: ${messageBody}`);

	const user = DB.getUserByPhone(senderPhone);

	if (!user) {
		console.warn(`Unknown number ${senderPhone}`);
		res.type("text/xml").send("<Response></Response>");
		return;
	}

	try {
		if (user.role === "evaluator") {
			await handleEvaluatorMessage(user, messageBody);
		} else if (user.role === "greeter") {
			await handleGreeterMessage(user, messageBody);
		}
	} catch (err) {
		console.error("Error processing SMS:", err);
	}

	res.type("text/xml").send("<Response></Response>");
});

async function handleEvaluatorMessage(user: DB.User, text: string) {
	DB.setLastActiveEvaluator(user.phone_number);

	const greeters = DB.getAllGreeters();

	const promises = greeters.map((greeter) =>
		client.messages.create({
			to: greeter.phone_number,
			from: TWILIO_PHONE,
			body: `[${user.name}] ${text}`,
		}),
	);

	await Promise.all(promises);
}

async function handleGreeterMessage(user: DB.User, text: string) {
	const targetEvaluatorPhone = DB.getLastActiveEvaluator();

	if (!targetEvaluatorPhone) {
		console.warn("No active evaluator found");
		return;
	}

	await client.messages.create({
		to: targetEvaluatorPhone,
		from: TWILIO_PHONE,
		body: `[${user.name}] ${text}`,
	});
}

app.listen(PORT, () => {
	console.log(`TypeScript SMS Server running on port ${PORT}`);
});
