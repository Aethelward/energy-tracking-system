import { json } from '@sveltejs/kit';
import { PRIVATE_RESEND_API_KEY } from '$env/static/private';
import { Resend } from 'resend';

const resend = new Resend(PRIVATE_RESEND_API_KEY);

export async function POST({ request }) {
	const { message, email } = await request.json();

	if (!message || !email) {
		return json({ error: 'Missing data' }, { status: 400 });
	}

	try {
		const result = await resend.emails.send({
			from: 'ETracker System <noreply@energy-tracking-system.online>',
			to: email,
			subject: '⚠️ ETRACKER Critical Alert',
			html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #d32f2f;">System Alert Triggered</h2>
                    <p style="font-size: 16px; color: #333;">${message}</p>
                    <p style="font-size: 12px; color: #718096; margin-top: 20px;">
                        This is an automated message from your Energy Tracking System.
                    </p>
                </div>
            `
		});

		// NEW: Check if Resend returned an API error inside the response object
		if (result.error) {
			console.error('Resend API Error:', result.error);
			// Pass the correct status code (like 401 or 403) back to the frontend
			return json({ error: result.error.message }, { status: result.error.statusCode || 400 });
		}

		return json(result.data);
	} catch (error) {
		// This will now only catch actual server/network crashes
		console.error('Server/Network Error:', error);
		return json({ error: 'Failed to send email due to server error' }, { status: 500 });
	}
}
