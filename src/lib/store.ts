import { writable } from 'svelte/store';

// Global memory for the realtime chart
export const pChartLabels = writable<string[]>([]);
export const pChartVolt = writable<number[]>([]);
export const pChartCurr = writable<number[]>([]);
export const pChartPower = writable<number[]>([]);

// Global memory for gauges and states
export const pVoltage = writable<number>(0);
export const pCurrent = writable<number>(0);
export const pPower = writable<number>(0);
export const pIsOnline = writable<boolean>(true);
export const pAlerts = writable<{ message: string; time: string }[]>([
	{ message: 'System Online', time: 'Now' }
]);

// Global Notification Cooldowns
export const globalEmailCooldown = writable<number>(0);
export const globalSmsCooldown = writable<number>(0);
