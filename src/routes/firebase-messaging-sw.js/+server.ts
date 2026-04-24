import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const script = `importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '${env.PUBLIC_MAIN_FIREBASE_API_KEY ?? ''}',
  authDomain: '${env.PUBLIC_MAIN_FIREBASE_AUTH_DOMAIN ?? ''}',
  projectId: '${env.PUBLIC_MAIN_FIREBASE_PROJECT_ID ?? ''}',
  storageBucket: '${env.PUBLIC_MAIN_FIREBASE_STORAGE_BUCKET ?? ''}',
  messagingSenderId: '${env.PUBLIC_MAIN_FIREBASE_MESSAGING_SENDER_ID ?? ''}',
  appId: '${env.PUBLIC_MAIN_FIREBASE_APP_ID ?? ''}'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload?.notification?.title ?? 'Energy Tracking Alert';
  const options = {
    body: payload?.notification?.body ?? 'New critical alert',
    icon: '/logo.png',
    badge: '/logo.png',
    requireInteraction: true
  };

  self.registration.showNotification(title, options);
});`;

	return new Response(script, {
		headers: {
			'content-type': 'application/javascript; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};
