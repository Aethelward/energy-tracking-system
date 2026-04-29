import { writable, get } from 'svelte/store';
import { dbApi, mainDb } from '$lib/firebase';

export const isSimulating = writable(false);
export const spikeMode = writable(false);
export const mockVoltageStore = writable(220);
export const mockCurrentStore = writable(15);
export const deviceStatusStore = writable('connected');

let simInterval: ReturnType<typeof setInterval> | null = null;

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

export function toggleSimulation() {
	const currentlyRunning = get(isSimulating);

	if (currentlyRunning) {
		// Stop it
		isSimulating.set(false);
		if (simInterval) {
			clearInterval(simInterval);
			simInterval = null;
		}
	} else {
		// Start it
		isSimulating.set(true);
		deviceStatusStore.set('connected');
		startSimulation();
	}
}

export function ensureSimulatorCleanup() {
	const isRunning = get(isSimulating);
	const hasInterval = simInterval !== null;

	if (isRunning && !hasInterval) {
		// Store says running but interval is missing - restart it
		startSimulation();
	} else if (!isRunning && hasInterval) {
		// Store says stopped but interval still exists - clean it up
		clearInterval(simInterval!);
		simInterval = null;
	}
}

function startSimulation() {
	if (simInterval) clearInterval(simInterval);

	simInterval = setInterval(() => {
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
	isSimulating.set(false);
	if (simInterval) {
		clearInterval(simInterval);
		simInterval = null;
	}
}
