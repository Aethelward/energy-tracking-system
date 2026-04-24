import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
	PUBLIC_GROUND_FIREBASE_API_KEY,
	PUBLIC_GROUND_FIREBASE_AUTH_DOMAIN,
	PUBLIC_GROUND_FIREBASE_DATABASE_URL,
	PUBLIC_GROUND_FIREBASE_PROJECT_ID,
	PUBLIC_MAIN_FIREBASE_API_KEY,
	PUBLIC_MAIN_FIREBASE_APP_ID,
	PUBLIC_MAIN_FIREBASE_AUTH_DOMAIN,
	PUBLIC_MAIN_FIREBASE_DATABASE_URL,
	PUBLIC_MAIN_FIREBASE_MESSAGING_SENDER_ID,
	PUBLIC_MAIN_FIREBASE_PROJECT_ID,
	PUBLIC_MAIN_FIREBASE_STORAGE_BUCKET,
	PUBLIC_SECOND_FIREBASE_API_KEY,
	PUBLIC_SECOND_FIREBASE_AUTH_DOMAIN,
	PUBLIC_SECOND_FIREBASE_DATABASE_URL,
	PUBLIC_SECOND_FIREBASE_PROJECT_ID
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

const groundConfig = {
	apiKey: PUBLIC_GROUND_FIREBASE_API_KEY,
	authDomain: PUBLIC_GROUND_FIREBASE_AUTH_DOMAIN,
	databaseURL: PUBLIC_GROUND_FIREBASE_DATABASE_URL,
	projectId: PUBLIC_GROUND_FIREBASE_PROJECT_ID
};

const secondConfig = {
	apiKey: PUBLIC_SECOND_FIREBASE_API_KEY,
	authDomain: PUBLIC_SECOND_FIREBASE_AUTH_DOMAIN,
	databaseURL: PUBLIC_SECOND_FIREBASE_DATABASE_URL,
	projectId: PUBLIC_SECOND_FIREBASE_PROJECT_ID
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

const groundApp = getOrCreateApp('groundApp', groundConfig);
const secondApp = getOrCreateApp('secondApp', secondConfig);

export const groundDb = getDatabase(groundApp);
export const secondDb = getDatabase(secondApp);

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
