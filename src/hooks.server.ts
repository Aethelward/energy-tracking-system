import { redirect, type Handle } from '@sveltejs/kit';

const PUBLIC_PATHS = [
	'/login',
	'/firebase-messaging-sw.js',
	'/robots.txt',
	'/manifest.json',
	'/logo.png'
];

function isPublicPath(pathname: string): boolean {
	if (pathname.startsWith('/_app')) return true;
	if (pathname.startsWith('/favicon')) return true;
	return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const hasAuthCookie = event.cookies.get('ets_auth') === '1';

	if (!hasAuthCookie && !isPublicPath(pathname)) {
		throw redirect(303, '/login');
	}

	if (hasAuthCookie && pathname === '/login') {
		throw redirect(303, '/');
	}

	return resolve(event);
};
