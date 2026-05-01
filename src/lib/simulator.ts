import { writable, get } from 'svelte/store';
import { dbApi, mainDb } from '$lib/firebase';
import { browser } from '$app/environment';

const isClient = typeof window !== 'undefined' && browser;

declare global {
	interface Window {
		_ets_isSimulating: ReturnType<typeof writable<boolean>>;
		_ets_simInterval: NodeJS.Timeout | null;
		_ets_listenerAdded: boolean;
	}
}

// 1. CREATE THE IMMORTAL STORE
if (isClient && !window._ets_isSimulating) {
	const savedState = localStorage.getItem('ets_simulating') === 'true';
	window._ets_isSimulating = writable(savedState);
}

export const isSimulating = isClient ? window._ets_isSimulating : writable(false);

export const spikeMode = writable(false);
export const mockVoltageStore = writable(220);
export const mockCurrentStore = writable(15);
export const deviceStatusStore = writable('connected');

export async function sendMockData(v: number, c: number, status: string) {
	const power = v * c;
	try {
		await dbApi.set(dbApi.ref(mainDb, 'electricity'), {
			voltage: Number(v.toFixed(1)),
			current: Number(c.toFixed(2)),
			power: Number(power.toFixed(1)),
			status: status,
			timestamp: Date.now()
		});
	} catch (error) {
		console.error('Failed to send mock data:', error);
	}
}

// 2. EXPLICIT CONTROLS
export function startSimulator() {
	if (!isClient) return;

	window._ets_isSimulating.set(true);
	deviceStatusStore.set('connected');
	localStorage.setItem('ets_simulating', 'true');

	if (window._ets_simInterval) {
		clearInterval(window._ets_simInterval as NodeJS.Timeout);
	}

	window._ets_simInterval = setInterval(() => {
		let v = 218.5 + Math.random() * 4;
		let c = 5 + Math.random() * 10;

		if (get(spikeMode)) {
			if (Math.random() > 0.85) v = 245 + Math.random() * 10;
			if (Math.random() > 0.9) c = 85 + Math.random() * 10;
		}

		mockVoltageStore.set(Number(v.toFixed(1)));
		mockCurrentStore.set(Number(c.toFixed(2)));

		sendMockData(v, c, 'connected');
	}, 1000);
}

export function stopSimulator() {
	if (!isClient) return;

	window._ets_isSimulating.set(false);
	localStorage.setItem('ets_simulating', 'false');

	if (window._ets_simInterval) {
		clearInterval(window._ets_simInterval as NodeJS.Timeout);
		window._ets_simInterval = null;
	}
}

export function toggleSimulation() {
	const currentState = get(window._ets_isSimulating);
	if (currentState) {
		stopSimulator();
	} else {
		startSimulator();
	}
}

// 3. CROSS-TAB SYNC
if (isClient && !window._ets_listenerAdded) {
	window._ets_listenerAdded = true;

	window.addEventListener('storage', (e) => {
		if (e.key === 'ets_simulating') {
			const shouldRun = e.newValue === 'true';
			const currentlyRunning = get(window._ets_isSimulating);

			if (shouldRun && !currentlyRunning) {
				startSimulator();
			} else if (!shouldRun && currentlyRunning) {
				stopSimulator();
			}
		}
	});
}
