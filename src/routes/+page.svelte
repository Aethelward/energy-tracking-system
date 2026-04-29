<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import type { Chart as ChartJS } from 'chart.js';
	import { get } from 'svelte/store';
	import {
		pChartLabels,
		pChartVolt,
		pChartCurr,
		pChartPower,
		pVoltage,
		pCurrent,
		pPower,
		pIsOnline,
		pAlerts,
		globalEmailCooldown,
		globalSmsCooldown
	} from '$lib/store';
	import { auth, authApi, dbApi, mainDb, type DataSnapshot } from '$lib/firebase';

	type RealtimeData = {
		timestamp?: number;
		timeLabel?: string;
		voltage: number;
		current: number;
		power?: number;
	};

	const COOLDOWN_TIME = 10 * 60 * 1000; // 10 Minutes in milliseconds

	async function sendEmailAlert(message: string) {
		if (!userNotifications?.enableEmail || !userNotifications?.email) return;

		const now = Date.now();
		const lastSent = get(globalEmailCooldown);

		// If 10 minutes haven't passed since the LAST email, abort immediately.
		if (now - lastSent < COOLDOWN_TIME) return;

		// LOCK THE GLOBAL COOLDOWN IMMEDIATELY to prevent loop-spam
		globalEmailCooldown.set(now);

		try {
			await fetch('/api/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message, email: userNotifications.email })
			});
			console.log(`Email Sent: ${message}`);
		} catch (err) {
			globalEmailCooldown.set(0); // Unlock if the network fails
			console.error('Failed to trigger Email:', err);
		}
	}

	async function sendSmsAlert(message: string) {
		if (!userNotifications?.enableSms || !userNotifications?.phone) return;

		const now = Date.now();
		const lastSent = get(globalSmsCooldown);

		if (now - lastSent < COOLDOWN_TIME) return;

		globalSmsCooldown.set(now);

		try {
			await fetch('/api/sms', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message, phone: userNotifications.phone })
			});
			console.log(`SMS Sent: ${message}`);
		} catch (err) {
			globalSmsCooldown.set(0);
			console.error('Failed to trigger SMS:', err);
		}
	}

	// --- View States ---
	let currentView: 'live' | 'history' = 'live';
	let historyViewMode: 'graph' | 'table' = 'graph';
	let historyChartType: 'bar' | 'line' = 'bar';

	// --- Realtime States ---
	let voltage = get(pVoltage);
	let current = get(pCurrent);
	let power = get(pPower);
	let selectedDataType: 'voltage' | 'current' | 'power' = 'voltage';
	let alerts: { message: string; time: string }[] = get(pAlerts);

	let lastDataTime = Date.now();
	let lastVoltChangeTime = Date.now();
	let lastVoltageValue: number | null = null;
	let isOnline = get(pIsOnline);

	// --- History & Table States ---
	let timeframe: 'hour' | 'day' | 'month' | 'year' = 'day';

	let selectedDate = new Date().toISOString().split('T')[0];
	let selectedHour = new Date().getHours().toString().padStart(2, '0');

	let historicalData: RealtimeData[] = [];
	let isExporting = false;

	// --- Insights & Thresholds ---
	let insight1 = 'Loading technical analysis...';
	let insight2 = 'Calculating load efficiency...';
	let userThresholds: {
		muted?: boolean;
		voltage?: { min: number; max: number };
		current?: { min: number; max: number };
		power?: { min: number; max: number };
	} | null = null;
	let userNotifications: {
		email?: string;
		phone?: string;
		enableSms?: boolean;
		enableEmail?: boolean;
		threshStartTime?: string;
		threshEndTime?: string;
		reminders?: string[];
	} | null = null;
	const lastNotificationTimes: Record<string, number> = {};

	const insightData = [
		'Voltage stability is within 98% efficiency today.',
		'Current load suggests no major appliance spikes.',
		'Power consumption is 5% lower than previous hour.',
		'System check: Casing temperature is optimal.',
		'Peak usage detected; consider balancing load.',
		'Energy saving tip: Unplug idle devices for 2% gain.',
		'Frequency monitoring shows standard 60Hz stability.',
		'Estimated daily cost is trending below monthly average.'
	];

	// --- Chart Instances ---
	let chart: ChartJS<'line', number[], string> | null = null;
	let historyChart: ChartJS<'bar' | 'line', number[], string> | null = null;
	let gVolt: ChartJS | null = null;
	let gAmp: ChartJS | null = null;
	let ChartCtor: typeof import('chart.js/auto').default | null = null;

	// --- Animated Gauge States ---
	const animVoltage = tweened(get(pVoltage), { duration: 1000, easing: cubicOut });
	const animCurrent = tweened(get(pCurrent), { duration: 1000, easing: cubicOut });

	// Automatically redraw the gauges when the tween updates
	animVoltage.subscribe(($val) => {
		if (gVolt) {
			(gVolt.data.datasets[0] as unknown as { needleValue: number }).needleValue = $val;
			gVolt.update('none'); // 'none' prevents Chart.js from fighting Svelte's animation
		}
	});

	animCurrent.subscribe(($val) => {
		if (gAmp) {
			(gAmp.data.datasets[0] as unknown as { needleValue: number }).needleValue = $val;
			gAmp.update('none');
		}
	});

	// --- Utilities & Alerts ---
	function nowTime() {
		return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function addAlert(message: string) {
		alerts = [{ message, time: nowTime() }, ...alerts].slice(0, 10);
		pAlerts.set(alerts);
	}

	function clearAlerts() {
		alerts = [];
		pAlerts.set(alerts);
	}

	function requestNotificationPermission() {
		if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
			Notification.requestPermission();
		}
	}

	function sendBrowserNotification(title: string, msg: string) {
		if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
		const now = Date.now();
		if (!lastNotificationTimes[msg] || now - lastNotificationTimes[msg] > 300000) {
			new Notification(title, { body: msg, icon: '/logo.png' });
			lastNotificationTimes[msg] = now;
		}
	}

	const lastEmailTimes: Record<string, number> = {};

	function isTimeInThresholdRange() {
		if (
			!userNotifications ||
			!userNotifications.threshStartTime ||
			!userNotifications.threshEndTime
		)
			return true;
		const now = new Date();
		const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
		const start = userNotifications.threshStartTime;
		const end = userNotifications.threshEndTime;

		if (start <= end) {
			return currentTime >= start && currentTime <= end;
		} else {
			return currentTime >= start || currentTime <= end;
		}
	}

	function checkReminders() {
		if (!userNotifications?.reminders?.length) return;
		const now = new Date();
		const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
		for (const reminderTime of userNotifications.reminders) {
			if (!reminderTime) continue;
			if (currentTime === reminderTime) {
				if (power > 0) {
					const msg = `Reminder: Devices are still turned on! Detected ${power}W power usage at ${reminderTime}.`;
					if (!lastNotificationTimes[msg] || Date.now() - lastNotificationTimes[msg] > 60000) {
						addAlert(msg);
						sendBrowserNotification('Scheduled Device Reminder', msg);
						lastNotificationTimes[msg] = Date.now();
						sendSmsAlert(msg);
						sendEmailAlert(msg);
					}
				} else {
					const msg = `Reminder: Please check the system. Time: ${reminderTime}`;
					if (!lastNotificationTimes[msg] || Date.now() - lastNotificationTimes[msg] > 60000) {
						addAlert(msg);
						sendBrowserNotification('Scheduled Reminder', msg);
						lastNotificationTimes[msg] = Date.now();
					}
				}
			}
		}
	}

	function checkAlerts(data: RealtimeData) {
		if (!isTimeInThresholdRange()) return;

		const activeThresholds =
			userThresholds ||
			({
				voltage: { min: 200, max: 240 },
				current: { max: 15 },
				power: { min: 0, max: 99999 }
			} as const);

		const pending: { msg: string; type: string }[] = [];

		// --- 1. SYSTEM NORMAL BOUNDS (ALERTS) ---
		if (data.voltage > 241.5)
			pending.push({
				msg: `High Voltage (Critical): ${data.voltage.toFixed(1)}V`,
				type: 'crit_high_v'
			});
		else if (data.voltage < 218.5)
			pending.push({
				msg: `Low Voltage (Critical): ${data.voltage.toFixed(1)}V`,
				type: 'crit_low_v'
			});

		if (data.current > 80)
			pending.push({
				msg: `High Current (Critical): ${data.current.toFixed(1)}A`,
				type: 'crit_high_c'
			});

		// --- 2. USER SETTINGS BOUNDS (WARNINGS) ---
		if (
			activeThresholds.voltage?.max !== undefined &&
			data.voltage > activeThresholds.voltage.max &&
			data.voltage <= 241.5
		) {
			pending.push({
				msg: `High Voltage (Warning): ${data.voltage.toFixed(1)}V`,
				type: 'warn_high_v'
			});
		}
		if (
			activeThresholds.voltage?.min !== undefined &&
			data.voltage < activeThresholds.voltage.min &&
			data.voltage >= 218.5
		) {
			pending.push({
				msg: `Low Voltage (Warning): ${data.voltage.toFixed(1)}V`,
				type: 'warn_low_v'
			});
		}
		if (
			activeThresholds.current?.max !== undefined &&
			data.current > activeThresholds.current.max &&
			data.current <= 80
		) {
			pending.push({
				msg: `High Current (Warning): ${data.current.toFixed(1)}A`,
				type: 'warn_high_c'
			});
		}
		if (
			activeThresholds.power?.max !== undefined &&
			data.power !== undefined &&
			data.power > activeThresholds.power.max
		) {
			pending.push({
				msg: `High Power Load (Warning): ${data.power.toFixed(1)}W`,
				type: 'warn_high_p'
			});
		}

		for (const alertObj of pending) {
			addAlert(alertObj.msg);
			sendBrowserNotification('Energy Tracking Alert', alertObj.msg);

			let finalMsg = `ETRACKER ALERT: ${alertObj.msg} detected. Please check the system.`;
			sendSmsAlert(finalMsg);
			sendEmailAlert(finalMsg);
		}
	}

	function updateInsights() {
		const first = Math.floor(Math.random() * insightData.length);
		const second = (first + 1) % insightData.length;
		insight1 = insightData[first];
		insight2 = insightData[second];
	}

	// --- Charts & Data Processing ---
	function forceZeroUI() {
		voltage = 0;
		current = 0;
		power = 0;
		if (gVolt) {
			(gVolt.data.datasets[0] as { needleValue?: number }).needleValue = 0;
			gVolt.update();
		}
		if (gAmp) {
			(gAmp.data.datasets[0] as { needleValue?: number }).needleValue = 0;
			gAmp.update();
		}
	}

	function createGauge(
		id: string,
		max: number,
		arcData: number[],
		arcColors: string[],
		arcLabels: string[]
	) {
		if (!ChartCtor) throw new Error('Chart library is not initialized.');
		const canvas = document.getElementById(id) as HTMLCanvasElement | null;
		if (!canvas) throw new Error(`Canvas not found: ${id}`);
		const gaugeDataset = {
			data: arcData,
			backgroundColor: arcColors,
			needleValue: 0,
			needleMax: max,
			circumference: 180,
			rotation: 270,
			cutout: '75%',
			borderWidth: 0
		} as unknown as ChartJS<'doughnut', number[], unknown>['data']['datasets'][number] & {
			needleValue?: number;
			needleMax?: number;
		};

		return new ChartCtor(canvas, {
			type: 'doughnut',
			data: {
				labels: arcLabels,
				datasets: [gaugeDataset]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				clip: false,
				layout: {
					padding: { top: 10, right: 15 }
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						enabled: true,
						displayColors: true,
						callbacks: {
							label: function (context) {
								return ` ${context.label}`;
							}
						}
					}
				}
			},
			plugins: [
				{
					id: 'needle',
					afterDatasetDraw(g) {
						const gauge = g as ChartJS<'doughnut', number[], unknown> & {
							_metasets?: Array<{ data?: Array<{ y: number }> }>;
						};
						const { ctx, data, chartArea } = gauge;
						const ds = data.datasets[0] as { needleValue?: number; needleMax?: number };
						const needleValue = ds.needleValue || 0;
						const dsMax = ds.needleMax || 100;
						const clampedValue = Math.min(Math.max(needleValue, 0), dsMax);
						const angle = Math.PI + (clampedValue / dsMax) * Math.PI;
						const cx = chartArea.width / 2;
						const cy = gauge._metasets?.[0]?.data?.[0]?.y;
						if (typeof cy !== 'number') return;
						ctx.save();
						ctx.translate(cx, cy);
						ctx.rotate(angle);
						ctx.beginPath();
						ctx.moveTo(0, -3);
						ctx.lineTo(chartArea.height / 1.5, 0);
						ctx.lineTo(0, 3);
						ctx.fillStyle = '#888'; // Lighter color for dark mode compatibility
						ctx.fill();
						ctx.restore();
					}
				}
			]
		});
	}

	function updateChartVisibility() {
		if (!chart) return;
		chart.data.datasets[0].hidden = selectedDataType !== 'voltage';
		chart.data.datasets[1].hidden = selectedDataType !== 'current';
		chart.data.datasets[2].hidden = selectedDataType !== 'power';
		chart.update();
	}

	function processRealtimeData(data: RealtimeData) {
		if (typeof data.voltage !== 'number' || typeof data.current !== 'number') return;
		if (!chart) return;
		if (data.voltage !== lastVoltageValue) {
			lastVoltageValue = data.voltage;
			lastVoltChangeTime = Date.now();
		}
		lastDataTime = Date.now();

		checkAlerts(data);
		const p = typeof data.power === 'number' ? data.power : data.voltage * data.current;

		voltage = data.voltage;
		current = data.current;
		power = p;

		pVoltage.set(voltage);
		pCurrent.set(current);
		pPower.set(power);

		// Trigger the smooth gauge glides
		animVoltage.set(data.voltage);
		animCurrent.set(data.current);
	}

	// --- Firebase & History ---
	function renderHistoryChart() {
		const histCtx = (document.getElementById('historyChart') as HTMLCanvasElement)?.getContext(
			'2d'
		);
		if (!histCtx || !ChartCtor) return;

		let vPower = true;
		let vVoltage = false;
		let vCurrent = false;

		if (historyChart) {
			vPower = historyChart.isDatasetVisible(0);
			vVoltage = historyChart.isDatasetVisible(1);
			vCurrent = historyChart.isDatasetVisible(2);
			historyChart.destroy();
		}

		historyChart = new ChartCtor(histCtx, {
			type: historyChartType,
			data: {
				labels: historicalData.map((d) => d.timeLabel || ''),
				datasets: [
					{
						label: 'Voltage',
						data: historicalData.map((d) => d.voltage) as number[],
						borderColor: '#2e8b57',
						backgroundColor: '#2e8b57',
						tension: 0.4,
						borderWidth: 2,
						pointRadius: 0,
						fill: false,
						spanGaps: true,
						cubicInterpolationMode: 'monotone',
						yAxisID: 'y'
					},
					{
						label: 'Current',
						data: historicalData.map((d) => d.current) as number[],
						borderColor: '#ffa500',
						backgroundColor: '#ffa500',
						tension: 0.4,
						borderWidth: 2,
						pointRadius: 0,
						fill: false,
						spanGaps: true,
						cubicInterpolationMode: 'monotone',
						yAxisID: 'y'
					},
					{
						label: 'Power',
						data: historicalData.map((d) => d.power) as number[],
						borderColor: '#d32f2f',
						backgroundColor: '#d32f2f',
						tension: 0.4,
						borderWidth: 2,
						pointRadius: 0,
						fill: false,
						spanGaps: true,
						cubicInterpolationMode: 'monotone',
						yAxisID: 'y'
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				clip: false,
				layout: {
					padding: { top: 10, right: 15 }
				},
				plugins: { tooltip: { mode: 'index', intersect: false } },
				scales: {
					x: {
						title: { display: true, text: 'Time Period' }
					},
					y: {
						position: 'left',
						min: 0,
						suggestedMax: 250,
						grace: '10%',
						title: {
							display: true,
							text: 'Value (V / A / W)'
						},
						grid: {
							color: 'rgba(200, 200, 200, 0.1)'
						}
					}
				}
			}
		});
	}

	function changeHistoryChartType(newType: 'bar' | 'line') {
		historyChartType = newType;
		renderHistoryChart();
	}

	function switchTimeframe(newFrame: 'hour' | 'day' | 'month' | 'year') {
		timeframe = newFrame;
		fetchHistoricalData();
	}

	async function fetchHistoricalData() {
		const dateObj = new Date(selectedDate);
		const yyyy = dateObj.getFullYear().toString();
		const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
		const dd = dateObj.getDate().toString().padStart(2, '0');
		const hh = selectedHour.padStart(2, '0');

		let startKey = '';
		let endKey = '';
		let buckets: { label: string; vSum: number; cSum: number; pSum: number; count: number }[] = [];

		if (timeframe === 'hour') {
			startKey = `${yyyy}${mm}${dd}${hh}0000`;
			endKey = `${yyyy}${mm}${dd}${hh}5959`;
			for (let i = 0; i < 60; i++) {
				buckets.push({
					label: `${hh}:${i.toString().padStart(2, '0')}`,
					vSum: 0,
					cSum: 0,
					pSum: 0,
					count: 0
				});
			}
		} else if (timeframe === 'day') {
			startKey = `${yyyy}${mm}${dd}000000`;
			endKey = `${yyyy}${mm}${dd}235959`;
			for (let i = 0; i < 24; i++) {
				buckets.push({
					label: `${i.toString().padStart(2, '0')}:00`,
					vSum: 0,
					cSum: 0,
					pSum: 0,
					count: 0
				});
			}
		} else if (timeframe === 'month') {
			startKey = `${yyyy}${mm}01000000`;
			endKey = `${yyyy}${mm}31235959`;
			const daysInMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
			for (let i = 1; i <= daysInMonth; i++) {
				buckets.push({
					label: `${yyyy}-${mm}-${i.toString().padStart(2, '0')}`,
					vSum: 0,
					cSum: 0,
					pSum: 0,
					count: 0
				});
			}
		} else if (timeframe === 'year') {
			startKey = `${yyyy}0101000000`;
			endKey = `${yyyy}1231235959`;
			const monthNames = [
				'Jan',
				'Feb',
				'Mar',
				'Apr',
				'May',
				'Jun',
				'Jul',
				'Aug',
				'Sep',
				'Oct',
				'Nov',
				'Dec'
			];
			for (let i = 0; i < 12; i++) {
				buckets.push({ label: monthNames[i], vSum: 0, cSum: 0, pSum: 0, count: 0 });
			}
		}

		try {
			const historyRef = dbApi.query(
				dbApi.ref(mainDb, 'history'),
				dbApi.orderByKey(),
				dbApi.limitToLast(45000)
			);

			const snap = await dbApi.get(historyRef);
			const val = snap.val();

			if (val) {
				Object.entries(val).forEach(([key, data]: [string, any]) => {
					if (key >= startKey && key <= endKey) {
						let bucketIndex = -1;
						if (timeframe === 'hour') {
							bucketIndex = parseInt(key.substring(10, 12));
						} else if (timeframe === 'day') {
							bucketIndex = parseInt(key.substring(8, 10));
						} else if (timeframe === 'month') {
							bucketIndex = parseInt(key.substring(6, 8)) - 1;
						} else if (timeframe === 'year') {
							bucketIndex = parseInt(key.substring(4, 6)) - 1;
						}

						if (bucketIndex >= 0 && bucketIndex < buckets.length) {
							buckets[bucketIndex].vSum += data.voltage || 0;
							buckets[bucketIndex].cSum += data.current || 0;
							buckets[bucketIndex].pSum += data.power || 0;
							buckets[bucketIndex].count += 1;
						}
					}
				});
			}

			historicalData = buckets.map((b) => {
				const count = b.count > 0 ? b.count : 1;
				return {
					timeLabel: b.label,
					voltage: b.count > 0 ? b.vSum / count : 0,
					current: b.count > 0 ? b.cSum / count : 0,
					power: b.count > 0 ? b.pSum / count : 0
				};
			});

			renderHistoryChart();
		} catch (error) {
			console.error('Failed to load history data:', error);
			addAlert('Failed to load history');
		}
	}

	async function exportPDF() {
		isExporting = true;
		try {
			const html2pdf = (await import('html2pdf.js')).default;
			const pdfContainer = document.createElement('div');
			pdfContainer.style.padding = '30px';
			pdfContainer.style.fontFamily = 'Arial, sans-serif';
			pdfContainer.style.backgroundColor = 'white';

			pdfContainer.innerHTML = `
				<h2 style="color: #2e8b57; margin-bottom: 5px; border-bottom: 2px solid #2e8b57; padding-bottom: 10px;">
					Energy Consumption Report
				</h2>
				<p style="color: #555; font-size: 14px; margin-top: 10px; margin-bottom: 30px;">
					<strong>Report Date:</strong> ${selectedDate} <br>
					<strong>Time Filter:</strong> ${timeframe.toUpperCase()}
				</p>
			`;

			if (historyViewMode === 'graph') {
				const canvas = document.getElementById('historyChart') as HTMLCanvasElement;
				if (canvas) {
					const img = document.createElement('img');
					img.src = canvas.toDataURL('image/png', 1.0);
					img.style.width = '100%';
					pdfContainer.appendChild(img);
				}
			} else {
				const tableSource = document.querySelector('.table-responsive table');
				if (tableSource) {
					const tableClone = tableSource.cloneNode(true) as HTMLElement;
					tableClone.style.width = '100%';
					tableClone.style.borderCollapse = 'collapse';
					tableClone.style.fontSize = '12px';

					const headers = tableClone.querySelectorAll('th');
					headers.forEach((th) => {
						th.style.border = '1px solid #ddd';
						th.style.padding = '10px';
						th.style.backgroundColor = '#f4f7fa';
						th.style.color = '#333';
						th.style.textAlign = 'left';
					});

					const cells = tableClone.querySelectorAll('td');
					cells.forEach((td) => {
						td.style.border = '1px solid #ddd';
						td.style.padding = '10px';
						td.style.color = '#555';
					});

					pdfContainer.appendChild(tableClone);
				}
			}

			const opt = {
				margin: 0.5,
				filename: `Energy_Report_${timeframe}_${selectedDate}.pdf`,
				image: { type: 'jpeg' as 'jpeg' | 'png' | 'webp', quality: 0.98 },
				html2canvas: { scale: 2, useCORS: true },
				jsPDF: {
					unit: 'in' as const,
					format: 'letter' as const,
					orientation: 'portrait' as 'portrait' | 'landscape'
				}
			};

			await html2pdf().set(opt).from(pdfContainer).save();
		} catch (error) {
			console.error('PDF Export failed:', error);
			addAlert('Failed to export PDF');
		} finally {
			isExporting = false;
		}
	}

	onMount(() => {
		let unsubThresholds = () => {};
		let unsubElectricity = () => {};
		let unsubNotifications = () => {};
		let insightsInterval: ReturnType<typeof setInterval>;
		let clearIntervalId: ReturnType<typeof setInterval>;
		let watchdogInterval: ReturnType<typeof setInterval>;
		let reminderInterval: ReturnType<typeof setInterval>;
		let chartTickInterval: ReturnType<typeof setInterval>;

		void (async () => {
			ChartCtor = (await import('chart.js/auto')).default;
			updateInsights();
			requestNotificationPermission();

			insightsInterval = setInterval(updateInsights, 60000);
			clearIntervalId = setInterval(clearAlerts, 60000);

			watchdogInterval = setInterval(() => {
				const now = Date.now();
				if (now - lastDataTime > 65000 && isOnline) {
					isOnline = false;
					forceZeroUI();
					const msg = 'DEVICE DISCONNECTED';
					addAlert(msg);
					sendBrowserNotification('System Alert', msg);
					const updates = {
						'/electricity/voltage': 0,
						'/electricity/current': 0,
						'/electricity/power': 0,
						'/electricity/energy': 0,
						'/electricity/status': 'disconnected'
					};
					dbApi.update(dbApi.ref(mainDb), updates).catch((err: unknown) => {
						if (err instanceof Error) {
							console.error('Failed to zero database:', err);
						} else {
							console.error('Failed to zero database:', String(err));
						}
					});
				}
			}, 5000);

			const mainCtx = (document.getElementById('mainChart') as HTMLCanvasElement)?.getContext('2d');
			if (mainCtx && ChartCtor) {
				chart = new ChartCtor(mainCtx, {
					type: 'line',
					data: {
						labels: [...get(pChartLabels)],
						datasets: [
							{
								label: 'Voltage',
								data: [...get(pChartVolt)],
								borderColor: '#2e8b57',
								backgroundColor: '#2e8b57',
								tension: 0,
								borderWidth: 2,
								pointRadius: 0,
								fill: false,
								spanGaps: true,
								yAxisID: 'y'
							},
							{
								label: 'Current',
								data: [...get(pChartCurr)],
								borderColor: '#ffa500',
								backgroundColor: '#ffa500',
								borderWidth: 2,
								pointRadius: 0,
								fill: false,
								spanGaps: true,
								yAxisID: 'y'
							},
							{
								label: 'Power',
								data: [...get(pChartPower)],
								borderColor: '#d32f2f',
								backgroundColor: '#d32f2f',
								borderWidth: 2,
								pointRadius: 0,
								fill: false,
								spanGaps: true,
								yAxisID: 'y'
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						clip: false,
						layout: {
							padding: { top: 10, right: 15 }
						},
						scales: {
							x: {
								title: { display: true, text: 'Time Period' }
							},
							y: {
								position: 'left',
								min: 0,
								suggestedMax: 250,
								grace: '10%',
								title: {
									display: true,
									text: 'Value (V / A / W)'
								},
								grid: {
									color: 'rgba(200, 200, 200, 0.1)'
								}
							}
						},
						plugins: {
							legend: {
								display: true,
								position: 'top'
							}
						}
					}
				});
			}

			// Update the gauges to read from the store
			gVolt = createGauge(
				'gauge-v',
				300,
				[218.5, 23, 58.5],
				['#f59e0b', '#10b981', '#f59e0b'],
				['Under Voltage (< 218.5V)', 'Normal (218.5 - 241.5V)', 'Over Voltage (> 241.5V)']
			);
			(gVolt.data.datasets[0] as unknown as { needleValue: number }).needleValue = get(pVoltage);

			gAmp = createGauge(
				'gauge-a',
				100,
				[80, 15, 5],
				['#10b981', '#f59e0b', '#ef4444'],
				['Normal (0 - 80A)', 'Near Trip (81 - 95A)', 'Over Current (> 95A)']
			);
			(gAmp.data.datasets[0] as unknown as { needleValue: number }).needleValue = get(pCurrent);

			updateChartVisibility();

			chartTickInterval = setInterval(() => {
				if (!chart) return;
				const time = new Date().toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				});
				const labels = chart.data.labels ?? [];
				labels.push(time);
				chart.data.labels = labels;
				chart.data.datasets[0].data.push(voltage);
				chart.data.datasets[1].data.push(current);
				chart.data.datasets[2].data.push(power);
				if (labels.length > 20) {
					labels.shift();
					for (const dataset of chart.data.datasets) dataset.data.shift();
				}
				pChartLabels.set([...(labels as string[])]);
				pChartVolt.set([...(chart.data.datasets[0].data as number[])]);
				pChartCurr.set([...(chart.data.datasets[1].data as number[])]);
				pChartPower.set([...(chart.data.datasets[2].data as number[])]);

				chart.update('none');
			}, 1000);

			await fetchHistoricalData();

			unsubThresholds = dbApi.onValue(dbApi.ref(mainDb, 'thresholds'), (snap: DataSnapshot) => {
				userThresholds = snap.val();
			});

			unsubElectricity = dbApi.onValue(dbApi.ref(mainDb, 'electricity'), (snap: DataSnapshot) => {
				const val = snap.val();
				if (val) {
					const isZeroData = val.voltage === 0 && val.current === 0;

					if (val.status === 'disconnected' || isZeroData) {
						if (isOnline) {
							isOnline = false;
							forceZeroUI();
							addAlert('DEVICE DISCONNECTED');
						}
					} else {
						if (!isOnline) {
							isOnline = true;
							addAlert('Device Reconnected');
						}
						processRealtimeData({
							timestamp: Date.now(),
							voltage: val.voltage || 0,
							current: val.current || 0,
							power: val.power || val.voltage * val.current || 0
						});
					}
				}
			});

			authApi.onAuthStateChanged(auth, (user) => {
				if (unsubNotifications) {
					unsubNotifications();
				}
				if (user) {
					unsubNotifications = dbApi.onValue(
						dbApi.ref(mainDb, `users/${user.uid}/notifications`),
						(snap: DataSnapshot) => {
							userNotifications = snap.val();
						}
					);
				}
			});

			reminderInterval = setInterval(checkReminders, 60000);
		})();
		return () => {
			unsubThresholds();
			if (unsubNotifications) unsubNotifications();
			if (unsubElectricity) unsubElectricity();
			if (insightsInterval) clearInterval(insightsInterval);
			if (clearIntervalId) clearInterval(clearIntervalId);
			if (watchdogInterval) clearInterval(watchdogInterval);
			if (reminderInterval) clearInterval(reminderInterval);
			if (chartTickInterval) clearInterval(chartTickInterval);
			if (chart) chart.destroy();
			if (historyChart) historyChart.destroy();
			if (gVolt) gVolt.destroy();
			if (gAmp) gAmp.destroy();
		};
	});
</script>

<svelte:head>
	<title>Energy Tracking System - Dashboard</title>
</svelte:head>

<div class="dashboard-wrapper">
	<div class="dashboard-header">
		<div class="header-section no-print">
			<h1>
				System Dashboard
				<span class="status-badge" class:offline={!isOnline}>
					{isOnline ? 'Connected' : 'Disconnected'}
				</span>
			</h1>
			<p>
				{currentView === 'live'
					? 'Live monitoring and fault alerts dashboard'
					: 'Aggregated usage and historical reporting'}
			</p>
		</div>

		<div class="view-tabs">
			<button
				class={currentView === 'live' ? 'tab active' : 'tab'}
				onclick={() => (currentView = 'live')}
			>
				<i class="fas fa-satellite-dish"></i> Live Data
			</button>
			<button
				class={currentView === 'history' ? 'tab active' : 'tab'}
				onclick={() => (currentView = 'history')}
			>
				<i class="fas fa-history"></i> Historical Data
			</button>
		</div>
	</div>

	<div class="grid-container no-print" style="display: {currentView === 'live' ? 'grid' : 'none'};">
		<div class="main-column">
			<div class="card metrics-card">
				<div class="metric">
					<span class="label">Voltage</span>
					<span class="value sliding-number">
						{#each voltage.toFixed(1).split('') as char, i (i)}
							<span class="digit-wrapper">
								{#key char}
									<span
										class="digit"
										in:fly={{ y: -15, duration: 300 }}
										out:fly={{ y: 15, duration: 300 }}>{char}</span
									>
								{/key}
							</span>
						{/each}
						<span class="unit">V</span>
					</span>
				</div>
				<div class="metric">
					<span class="label">Current</span>
					<span class="value sliding-number">
						{#each current.toFixed(2).split('') as char, i (i)}
							<span class="digit-wrapper">
								{#key char}
									<span
										class="digit"
										in:fly={{ y: -15, duration: 300 }}
										out:fly={{ y: 15, duration: 300 }}>{char}</span
									>
								{/key}
							</span>
						{/each}
						<span class="unit">A</span>
					</span>
				</div>
				<div class="metric highlight">
					<span class="label">Power</span>
					<span class="value sliding-number">
						{#each power.toFixed(1).split('') as char, i (i)}
							<span class="digit-wrapper">
								{#key char}
									<span
										class="digit"
										in:fly={{ y: -15, duration: 300 }}
										out:fly={{ y: 15, duration: 300 }}>{char}</span
									>
								{/key}
							</span>
						{/each}
						<span class="unit">W</span>
					</span>
				</div>
			</div>

			<div class="card chart-card">
				<div class="card-header">
					<select bind:value={selectedDataType} onchange={updateChartVisibility}>
						<option value="voltage">Voltage (V)</option>
						<option value="current">Current (A)</option>
						<option value="power">Power (W)</option>
					</select>
					<button class="btn-refresh" onclick={() => location.reload()}>
						<i class="fas fa-sync-alt"></i> Refresh
					</button>
				</div>
				<div class="canvas-wrapper"><canvas id="mainChart"></canvas></div>
			</div>
		</div>

		<div class="side-column">
			<div class="card gauges-card">
				<div class="gauge-box">
					<div class="gauge-canvas"><canvas id="gauge-v"></canvas></div>
					<div class="gauge-value">{voltage.toFixed(0)}V</div>
					<div class="gauge-legend">
						<span class="legend-item"><span class="dot orange"></span> &lt; 218.5V (Under)</span>
						<span class="legend-item"><span class="dot green"></span> 218.5 - 241.5V (Normal)</span>
						<span class="legend-item"><span class="dot orange"></span> &gt; 241.5V (Over)</span>
					</div>
				</div>
				<div class="gauge-box">
					<div class="gauge-canvas"><canvas id="gauge-a"></canvas></div>
					<div class="gauge-value">{current.toFixed(1)}A</div>
					<div class="gauge-legend">
						<span class="legend-item"><span class="dot green"></span> 0 - 80A (Normal)</span>
						<span class="legend-item"><span class="dot orange"></span> 81 - 95A (Near Trip)</span>
						<span class="legend-item"><span class="dot red"></span> 96 - 100A (Over)</span>
					</div>
				</div>
			</div>

			<div class="card alerts-card">
				<div class="card-header warning-header">
					<span><i class="fas fa-bell"></i> Alerts</span>
					<button class="btn-clear" onclick={clearAlerts}>Clear</button>
				</div>
				<ul class="log-list">
					{#each alerts as alert}
						<li><span>{alert.message}</span><span class="time">{alert.time}</span></li>
					{:else}
						<li class="empty">No alerts</li>
					{/each}
				</ul>
			</div>

			<div class="card insights-card">
				<div class="card-header"><span><i class="fas fa-lightbulb"></i> Insight</span></div>
				<div class="insight-box">{insight1}</div>
				<div class="insight-box highlight-insight">{insight2}</div>
			</div>
		</div>
	</div>

	<div class="history-container" style="display: {currentView === 'history' ? 'flex' : 'none'};">
		<div class="card table-card">
			<div class="card-header table-header">
				<div class="history-controls no-print">
					<div class="filter-group mode-switcher">
						<button
							class={historyViewMode === 'graph' ? 'active' : ''}
							onclick={() => (historyViewMode = 'graph')}
						>
							<i class="fas fa-chart-area"></i> Graph
						</button>
						<button
							class={historyViewMode === 'table' ? 'active' : ''}
							onclick={() => (historyViewMode = 'table')}
						>
							<i class="fas fa-table"></i> Table
						</button>
					</div>

					{#if historyViewMode === 'graph'}
						<div class="filter-group chart-type-switcher">
							<button
								class={historyChartType === 'bar' ? 'active' : ''}
								onclick={() => changeHistoryChartType('bar')}
							>
								<i class="fas fa-chart-bar"></i> Bar
							</button>
							<button
								class={historyChartType === 'line' ? 'active' : ''}
								onclick={() => changeHistoryChartType('line')}
							>
								<i class="fas fa-chart-line"></i> Line
							</button>
						</div>
					{/if}

					<div class="filter-group date-picker-group">
						<input
							type="date"
							bind:value={selectedDate}
							onchange={fetchHistoricalData}
							class="date-input"
						/>
						{#if timeframe === 'hour'}
							<select bind:value={selectedHour} onchange={fetchHistoricalData} class="hour-input">
								{#each Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')) as hr}
									<option value={hr}>{hr}:00</option>
								{/each}
							</select>
						{/if}
					</div>

					<div class="filter-group">
						<button
							class={timeframe === 'hour' ? 'active' : ''}
							onclick={() => switchTimeframe('hour')}>Hour</button
						>
						<button
							class={timeframe === 'day' ? 'active' : ''}
							onclick={() => switchTimeframe('day')}>Day</button
						>
						<button
							class={timeframe === 'month' ? 'active' : ''}
							onclick={() => switchTimeframe('month')}>Month</button
						>
						<button
							class={timeframe === 'year' ? 'active' : ''}
							onclick={() => switchTimeframe('year')}>Year</button
						>
					</div>
				</div>

				<button class="btn-export no-print" onclick={exportPDF} disabled={isExporting}>
					<i class="fas fa-file-pdf"></i>
					{isExporting ? 'Exporting Document...' : 'Export PDF'}
				</button>
			</div>

			<div
				class="history-content"
				style="display: {historyViewMode === 'graph' ? 'block' : 'none'};"
			>
				<div class="canvas-wrapper" style="height: 500px;">
					<canvas id="historyChart"></canvas>
				</div>
			</div>

			<div
				class="history-content"
				style="display: {historyViewMode === 'table' ? 'block' : 'none'};"
			>
				<div class="table-responsive">
					<table>
						<thead>
							<tr>
								<th
									>{timeframe === 'hour'
										? 'Minute'
										: timeframe === 'day'
											? 'Hour'
											: timeframe === 'month'
												? 'Date'
												: 'Month'}</th
								>
								<th>Average Voltage (V)</th>
								<th>Average Current (A)</th>
								<th>Total Power (W)</th>
							</tr>
						</thead>
						<tbody>
							{#each historicalData as row}
								<tr>
									<td>{row.timeLabel}</td>
									<td>{row.voltage.toFixed(2)}</td>
									<td>{row.current.toFixed(2)}</td>
									<td class="power-cell">{row.power?.toFixed(2)}</td>
								</tr>
							{:else}
								<tr><td colspan="4" class="empty">No data available for this timeframe.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* All hardcoded whites and grays have been replaced with the CSS variables */

	.status-badge {
		font-size: 0.9rem;
		padding: 4px 10px;
		border-radius: 12px;
		background: var(--primary);
		color: white;
		margin-left: 10px;
		vertical-align: middle;
	}
	.status-badge.offline {
		background: var(--accent-red);
	}

	.dashboard-wrapper {
		max-width: 1550px;
		margin: 0 auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 20px;
	}

	.view-tabs {
		display: flex;
		background: var(--hover-bg);
		padding: 4px;
		border-radius: 8px;
		gap: 4px;
	}
	.view-tabs .tab {
		border: none;
		background: transparent;
		padding: 8px 20px;
		font-weight: 600;
		color: var(--text-muted);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.view-tabs .tab.active {
		background: var(--card-bg);
		color: var(--primary);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.header-section h1 {
		margin: 0;
		font-size: 28px;
		text-transform: uppercase;
		font-weight: 900;
	}
	.header-section p {
		margin: 5px 0 0;
		color: var(--primary);
		font-weight: 800;
	}

	.grid-container {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 20px;
	}
	.history-container {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.main-column,
	.side-column {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.card {
		background: var(--card-bg);
		border-radius: 12px;
		border: 1px solid var(--border);
		padding: 20px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.03);
	}
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15px;
		font-weight: bold;
		font-size: 14px;
		color: var(--text-muted);
	}

	.metrics-card {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 15px;
	}
	.metric {
		display: flex;
		flex-direction: column;
		padding: 15px;
		background: var(--input-bg);
		border-radius: 8px;
		border: 1px solid var(--border);
	}
	.metric.highlight {
		background: rgba(46, 139, 87, 0.1);
		border-color: var(--primary);
	}
	.metric .label {
		font-size: 12px;
		color: var(--text-muted);
		text-transform: uppercase;
		font-weight: bold;
	}
	.metric .value {
		font-size: 32px;
		font-weight: 800;
		margin-top: 5px;
	}
	.metric .unit {
		font-size: 16px;
		color: var(--primary);
		margin-left: 4px;
	}

	.sliding-number {
		display: flex;
		align-items: baseline;
		font-variant-numeric: tabular-nums;
		font-family: 'Roboto Mono', 'Consolas', 'Courier New', monospace;
		/* letter-spacing: -1px; */
	}
	.digit-wrapper {
		display: inline-grid;
		overflow: hidden;
	}
	.digit {
		grid-area: 1 / 1;
	}

	.chart-card {
		min-height: 400px;
		display: flex;
		flex-direction: column;
	}
	.chart-card select {
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--input-bg);
		color: var(--text-main);
	}
	.btn-refresh {
		padding: 8px 12px;
		border-radius: 6px;
		border: none;
		background: var(--primary);
		color: white;
		cursor: pointer;
		font-weight: 600;
	}
	.canvas-wrapper {
		flex: 1;
		position: relative;
		min-height: 300px;
		width: 100%;
	}

	.gauges-card {
		display: flex;
		gap: 15px;
	}
	.gauge-box {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: auto;
		padding-bottom: 10px;
	}
	.gauge-canvas {
		width: 100%;
		height: 120px;
		position: relative;
	}
	.gauge-value {
		font-weight: 800;
		font-size: 22px;
		margin-top: 5px;
		margin-bottom: 15px;
		color: var(--text-main);
		font-variant-numeric: tabular-nums;
		font-family: 'Roboto Mono', 'Consolas', 'Courier New', monospace;
		letter-spacing: -1px;
	}

	.gauge-legend {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 11px;
		color: var(--text-muted);
		align-items: flex-start;
		width: 100%;
		padding-left: 8%;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: inline-block;
	}
	.dot.green {
		background-color: #10b981;
	}
	.dot.orange {
		background-color: #f59e0b;
	}
	.dot.red {
		background-color: #ef4444;
	}

	.alerts-card {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		max-height: 300px;
	}
	.warning-header {
		color: var(--accent-red);
		justify-content: space-between;
		display: flex;
	}
	.btn-clear {
		background: var(--accent-red);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 4px 8px;
		font-size: 11px;
		cursor: pointer;
		font-weight: bold;
	}
	.log-list {
		list-style: none;
		padding: 0;
		margin: 0;
		overflow-y: auto;
		font-size: 12px;
	}
	.log-list li {
		display: flex;
		justify-content: space-between;
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
	}
	.log-list .time {
		color: var(--text-muted);
	}

	.insights-card {
		flex: 0 0 auto;
	}
	.insight-box {
		background: var(--input-bg);
		border-left: 4px solid var(--primary);
		padding: 12px;
		font-size: 13px;
		color: var(--primary);
		margin-top: 10px;
	}
	.highlight-insight {
		background: rgba(26, 115, 232, 0.1);
		color: #4285f4;
		border-color: #4285f4;
	}

	.table-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin-bottom: 20px;
		font-size: 18px;
		color: var(--text-main);
		flex-wrap: wrap;
		gap: 15px;
	}
	.history-controls {
		display: flex;
		gap: 15px;
		flex-wrap: wrap;
	}

	.date-picker-group {
		background: var(--card-bg);
		border: 1px solid var(--border);
	}
	.date-input,
	.hour-input {
		border: none;
		background: transparent;
		padding: 8px 12px;
		font-family: inherit;
		color: var(--text-main);
		font-weight: 600;
		outline: none;
		cursor: pointer;
	}
	.hour-input {
		border-left: 1px solid var(--border);
	}

	.filter-group {
		display: flex;
		background: var(--hover-bg);
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--border);
	}
	.filter-group button {
		border: none;
		background: none;
		padding: 8px 16px;
		font-size: 13px;
		cursor: pointer;
		font-weight: 600;
		color: var(--text-muted);
		transition: 0.2s;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.filter-group button:hover {
		background: var(--border);
	}
	.filter-group button.active {
		background: var(--card-bg);
		color: var(--primary);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border-radius: 6px;
	}

	.mode-switcher {
		background: var(--input-bg);
	}
	.chart-type-switcher {
		background: rgba(245, 158, 11, 0.05);
		border-color: rgba(245, 158, 11, 0.2);
	}
	.chart-type-switcher button.active {
		color: #f59e0b;
	}

	.btn-export {
		background: var(--primary);
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: bold;
		display: flex;
		align-items: center;
		gap: 6px;
		height: fit-content;
	}
	.btn-export:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.history-content {
		width: 100%;
		animation: fadeIn 0.3s ease-in-out;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.table-responsive {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}
	th,
	td {
		padding: 12px 15px;
		border-bottom: 1px solid var(--border);
		font-size: 14px;
	}
	th {
		background: var(--input-bg);
		color: var(--text-muted);
		font-weight: 800;
		text-transform: uppercase;
		font-size: 12px;
	}
	.power-cell {
		font-weight: bold;
		color: var(--primary-dark);
	}
	.empty {
		text-align: center;
		color: var(--text-muted);
		font-style: italic;
	}

	@media (max-width: 1024px) {
		.grid-container {
			grid-template-columns: 1fr;
		}
		.table-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	@media (max-width: 768px) {
		.dashboard-wrapper {
			padding: 12px;
			overflow-x: hidden;
		}

		.dashboard-header {
			flex-direction: column;
			align-items: stretch;
			gap: 15px;
		}

		.view-tabs {
			flex-direction: row;
			width: 100%;
		}
		.view-tabs .tab {
			flex: 1;
			justify-content: center;
			padding: 10px 5px;
			font-size: 13px;
		}

		.metrics-card {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.chart-card {
			min-height: 320px;
		}
		.canvas-wrapper {
			min-height: 250px;
		}

		.gauges-card {
			flex-direction: column;
			gap: 25px;
		}

		.history-controls {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
		}
		.filter-group {
			flex-wrap: wrap;
		}
		.filter-group button {
			flex: 1;
			justify-content: center;
		}
		.date-picker-group {
			flex-direction: column;
		}
		.date-picker-group input,
		.date-picker-group select {
			width: 100%;
		}
		.btn-export {
			width: 100%;
			justify-content: center;
			margin-top: 5px;
		}
	}
</style>
