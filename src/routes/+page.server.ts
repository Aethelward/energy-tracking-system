import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	if (cookies.get('ets_auth') !== '1') {
		throw redirect(303, '/login');
	}
	return {};
};
