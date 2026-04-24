import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		csp: {
			mode: 'hash',
			directives: {
				'script-src': [
					'self',
					'unsafe-inline',
					'https://*.firebaseio.com',
					'https://*.firebasedatabase.app'
				],
				'frame-src': ['self', 'https://*.firebaseio.com', 'https://*.firebasedatabase.app']
			}
		}
	}
};

export default config;
