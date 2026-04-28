import { json } from '@sveltejs/kit';
import {
	PRIVATE_SEMAPHORE_API_KEY,
	PRIVATE_TWILIO_ACCOUNT_SID,
	PRIVATE_TWILIO_AUTH_TOKEN,
	PRIVATE_TWILIO_PHONE_NUMBER
} from '$env/static/private';

export async function POST({ request }) {
	const { message, phone } = await request.json();

	if (!message || !phone) {
		return json({ error: 'Missing data' }, { status: 400 });
	}

	// Format the Philippine number properly if they entered it as 09...
	let formattedPhone = phone;
	if (phone.startsWith('09')) {
		formattedPhone = '+63' + phone.substring(1);
	}

	try {
		// --- TWILIO IMPLEMENTATION ---
		const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${PRIVATE_TWILIO_ACCOUNT_SID}/Messages.json`;

		// Basic Auth requires base64 encoding of SID:TOKEN
		const authHeader =
			'Basic ' + btoa(`${PRIVATE_TWILIO_ACCOUNT_SID}:${PRIVATE_TWILIO_AUTH_TOKEN}`);

		const response = await fetch(twilioUrl, {
			method: 'POST',
			headers: {
				Authorization: authHeader,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				To: formattedPhone,
				From: PRIVATE_TWILIO_PHONE_NUMBER,
				Body: message
			})
		});

		const data = await response.json();

		if (!response.ok) {
			console.error('Twilio API Error:', data);
			return json({ error: data.message }, { status: response.status });
		}

		return json(data);

		// --- SEMAPHORE IMPLEMENTATION (COMMENTED OUT) ---
		/*
		const response = await fetch('https://api.semaphore.co/api/v4/messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				apikey: PRIVATE_SEMAPHORE_API_KEY,
				number: phone, // Semaphore handles 09... formats naturally
				message: message
			})
		});

		const data = await response.json();
		return json(data);
		*/
	} catch (error) {
		console.error('SMS Error:', error);
		return json({ error: 'Failed to send SMS' }, { status: 500 });
	}
}
