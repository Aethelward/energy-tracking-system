import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
	PUBLIC_MAIN_FIREBASE_API_KEY,
	PUBLIC_MAIN_FIREBASE_APP_ID,
	PUBLIC_MAIN_FIREBASE_AUTH_DOMAIN,
	PUBLIC_MAIN_FIREBASE_DATABASE_URL,
	PUBLIC_MAIN_FIREBASE_MESSAGING_SENDER_ID,
	PUBLIC_MAIN_FIREBASE_PROJECT_ID,
	PUBLIC_MAIN_FIREBASE_STORAGE_BUCKET
} from '$env/static/public';
import {
	getAuth,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut,
	updatePassword,
	updateProfile,
	type User
} from 'firebase/auth';
import {
	getDatabase,
	get,
	limitToLast,
	onValue,
	orderByKey,
	query,
	ref,
	set,
	update,
	startAt,
	endAt,
	type DataSnapshot
} from 'firebase/database';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const mainConfig = {
	apiKey: PUBLIC_MAIN_FIREBASE_API_KEY,
	authDomain: PUBLIC_MAIN_FIREBASE_AUTH_DOMAIN,
	databaseURL: PUBLIC_MAIN_FIREBASE_DATABASE_URL,
	projectId: PUBLIC_MAIN_FIREBASE_PROJECT_ID,
	storageBucket: PUBLIC_MAIN_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: PUBLIC_MAIN_FIREBASE_MESSAGING_SENDER_ID,
	appId: PUBLIC_MAIN_FIREBASE_APP_ID
};

const requiredMainKeys = [
	mainConfig.apiKey,
	mainConfig.authDomain,
	mainConfig.databaseURL,
	mainConfig.projectId,
	mainConfig.appId
];

if (requiredMainKeys.some((value) => !value)) {
	throw new Error('Missing Firebase env configuration. Check .env PUBLIC_* keys.');
}

function getOrCreateApp(name: string, config: object): FirebaseApp {
	const existing = getApps().find((app) => app.name === name);
	if (existing) return existing;
	return initializeApp(config, name);
}

export const mainApp = getApps().length === 0 ? initializeApp(mainConfig) : getApp();
export const auth = getAuth(mainApp);
export const mainDb = getDatabase(mainApp);

export const authApi = {
	signInWithEmailAndPassword,
	onAuthStateChanged,
	updatePassword,
	updateProfile,
	signOut
};

export const dbApi = {
	ref,
	get,
	set,
	update,
	onValue,
	query,
	orderByKey,
	limitToLast,
	startAt,
	endAt
};

export const messagingApi = {
	getMessaging,
	getToken,
	isSupported
};

export type { DataSnapshot, User };
