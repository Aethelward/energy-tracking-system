<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { dbApi, mainDb, auth, authApi, type User } from '$lib/firebase';
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';

	import {
		isSimulating,
		spikeMode,
		mockVoltageStore,
		mockCurrentStore,
		deviceStatusStore,
		sendMockData,
		toggleSimulation
	} from '$lib/simulator';

	// --- Notifications States ---
	let notificationEmail = '';
	let notificationPhone = '';
	let isSendingEmail = false;
	let isSendingSms = false;

	// --- Simulator States ---
	let isSending = false;

	async function triggerManual() {
		isSending = true;
		await sendMockData($mockVoltageStore, $mockCurrentStore, $deviceStatusStore);
		setTimeout(() => (isSending = false), 500);
	}

	async function triggerDisconnect() {
		isSending = true;
		$deviceStatusStore = 'disconnected';
		$mockVoltageStore = 0;
		$mockCurrentStore = 0;
		await sendMockData(0, 0, 'disconnected');
		setTimeout(() => (isSending = false), 500);
	}

	async function testEmail() {
		if (!notificationEmail) {
			alert('No email configured in settings.');
			return;
		}
		isSendingEmail = true;
		try {
			const res = await fetch('/api/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: 'This is a manual test email from the ETRACKER testing page.',
					email: notificationEmail
				})
			});
			if (res.ok) alert('Test email sent!');
			else alert('Failed to send test email.');
		} catch (e) {
			console.error(e);
			alert('Error sending email.');
		} finally {
			isSendingEmail = false;
		}
	}

	async function testSms() {
		if (!notificationPhone) {
			alert('No phone number configured in settings.');
			return;
		}
		isSendingSms = true;
		try {
			const res = await fetch('/api/sms', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					phone: notificationPhone,
					message: 'This is a manual test SMS from the ETRACKER testing page.'
				})
			});
			if (res.ok) alert('Test SMS sent!');
			else alert('Failed to send test SMS.');
		} catch (e) {
			console.error(e);
			alert('Error sending SMS.');
		} finally {
			isSendingSms = false;
		}
	}

	let unsubAuth = () => {};

	onMount(() => {
		unsubAuth = authApi.onAuthStateChanged(auth, async (user: User | null) => {
			if (user?.uid) {
				const notifSnap = await dbApi.get(dbApi.ref(mainDb, `users/${user.uid}/notifications`));
				const notifData = notifSnap.val();
				if (notifData) {
					notificationEmail = notifData.email ?? '';
					notificationPhone = notifData.phone ?? '';
				}
			}
		});
	});

	onDestroy(() => {
		unsubAuth();
	});
</script>

<svelte:head>
	<title>Manual Testing - Energy Tracking System</title>
</svelte:head>

<div class="testing-page-wrapper">
	<div class="settings-container">
		<button class="back-btn" on:click={() => goto(resolve('/'))}>
			<i class="fas fa-arrow-left"></i> Back to Dashboard
		</button>

		<div class="settings-header">
			<h1>Hardware Simulator</h1>
			<p>Inject mock data to test dashboard graphs and trigger threshold alerts.</p>
		</div>

		<div class="settings-card">
			<div class="card-title"><i class="fas fa-robot"></i> Automated Live Data</div>
			<p class="subtitle">
				Continuously feeds realistic data every 3 seconds to test the live graphs.
			</p>

			<div class="toggle-container">
				<div class="toggle-info">
					<strong>Enable Random Spikes</strong>
					<span class="text-sm"
						>Randomly pushes data past safe thresholds to test SMS/Email alerts.</span
					>
				</div>
				<label class="switch">
					<input type="checkbox" bind:checked={$spikeMode} disabled={!$isSimulating} />
					<span class="slider round"></span>
				</label>
			</div>

			<button
				class="action-btn {$isSimulating ? 'btn-red' : 'btn-primary'}"
				on:click={toggleSimulation}
			>
				{#if $isSimulating}
					<i class="fas fa-stop-circle"></i> Stop Simulation
				{:else}
					<i class="fas fa-play-circle"></i> Start Auto-Simulator
				{/if}
			</button>
		</div>

		<div
			class="settings-card"
			style="opacity: {$isSimulating ? '0.5' : '1'}; pointer-events: {$isSimulating
				? 'none'
				: 'auto'};"
		>
			<div class="card-title"><i class="fas fa-sliders-h"></i> Manual Value Injection</div>
			<p class="subtitle">
				Push precise numbers to test specific gauge colors and threshold limits.
			</p>

			<div class="slider-group">
				<label for="mock-voltage">Voltage: <strong>{$mockVoltageStore} V</strong></label>
				<input
					id="mock-voltage"
					type="range"
					min="0"
					max="300"
					step="0.1"
					bind:value={$mockVoltageStore}
					class="range-slider"
				/>
			</div>

			<div class="slider-group">
				<label for="mock-current">Current: <strong>{$mockCurrentStore} A</strong></label>
				<input
					id="mock-current"
					type="range"
					min="0"
					max="100"
					step="0.1"
					bind:value={$mockCurrentStore}
					class="range-slider"
				/>
			</div>

			<div class="slider-group">
				<div
					style="display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; margin-bottom: 10px; color: var(--text-main);"
				>
					Calculated Power: <strong style="color: var(--primary-color)"
						>{($mockVoltageStore * $mockCurrentStore).toFixed(1)} W</strong
					>
				</div>
			</div>

			<div class="button-row">
				<button class="action-btn btn-primary" on:click={triggerManual} disabled={isSending}>
					<i class="fas fa-upload"></i>
					{isSending ? 'Sending...' : 'Inject Data'}
				</button>
				<button class="action-btn btn-outline" on:click={triggerDisconnect} disabled={isSending}>
					<i class="fas fa-power-off"></i> Force Disconnect
				</button>
			</div>
		</div>

		<div class="settings-card">
			<div class="card-title"><i class="fas fa-bell"></i> Notification Testing</div>
			<p class="subtitle">
				Manually send test alerts to the email and phone number configured in Settings.
			</p>

			<div class="button-row" style="margin-top: 10px;">
				<button class="action-btn btn-primary" on:click={testEmail} disabled={isSendingEmail}>
					<i class="fas fa-envelope"></i>
					{isSendingEmail ? 'Sending...' : 'Test Email'}
				</button>
				<button class="action-btn btn-primary" on:click={testSms} disabled={isSendingSms}>
					<i class="fas fa-sms"></i>
					{isSendingSms ? 'Sending...' : 'Test SMS'}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	/* Uses the global CSS variables established in your +layout.svelte */

	.testing-page-wrapper {
		display: flex;
		justify-content: center;
		padding: 40px 20px;
		width: 100%;
		box-sizing: border-box;
		min-height: calc(100vh - 70px);
		background-color: var(--bg-color);
		color: var(--text-main);
	}

	.settings-container {
		width: 100%;
		max-width: 650px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.settings-header {
		margin-bottom: 5px;
	}

	.settings-header h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 800;
		color: var(--text-main);
	}

	.settings-header p {
		margin: 5px 0 0 0;
		color: var(--text-muted);
		font-size: 15px;
	}

	.settings-card {
		background-color: var(--card-bg);
		padding: 26px;
		border-radius: 16px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
		border: 1px solid var(--border-color);
		transition: all 0.3s ease;
	}

	.back-btn {
		align-self: flex-start;
		background: var(--card-bg);
		color: var(--text-main);
		border: 1px solid var(--border-color);
		padding: 10px 18px;
		font-size: 14px;
		font-weight: 700;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
	}
	.back-btn:hover {
		background: var(--input-bg);
		transform: translateY(-1px);
	}

	.card-title {
		font-size: 18px;
		font-weight: 700;
		margin: 0 0 6px 0;
		color: var(--text-main);
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.subtitle {
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: 22px;
		margin-top: 0;
		line-height: 1.5;
	}

	.slider-group {
		margin-bottom: 20px;
	}
	.slider-group label {
		display: flex;
		justify-content: space-between;
		font-weight: 600;
		color: var(--text-main);
		font-size: 14px;
		margin-bottom: 10px;
	}

	.range-slider {
		width: 100%;
		cursor: pointer;
		accent-color: var(--primary-color);
	}

	.button-row {
		display: flex;
		gap: 15px;
		margin-top: 25px;
	}

	.action-btn {
		flex: 1;
		padding: 12px;
		font-size: 14px;
		font-weight: 600;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: all 0.2s;
	}

	.btn-primary {
		background-color: var(--primary-color);
		color: white;
	}
	.btn-primary:hover:not(:disabled) {
		background-color: var(--primary-hover);
		transform: translateY(-1px);
	}

	.btn-red {
		background-color: var(--accent-red);
		color: white;
	}
	.btn-red:hover:not(:disabled) {
		background-color: var(--red-hover);
		transform: translateY(-1px);
	}

	.btn-outline {
		background: transparent;
		border: 1px solid var(--border-color);
		color: var(--text-main);
	}
	.btn-outline:hover:not(:disabled) {
		background: var(--input-bg);
	}

	.action-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Toggle Switch */
	.toggle-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--input-bg);
		padding: 15px 18px;
		border-radius: 8px;
		margin-bottom: 20px;
		border: 1px solid var(--border-color);
	}

	.toggle-info {
		display: flex;
		flex-direction: column;
	}
	.text-sm {
		font-size: 12px;
		color: var(--text-muted);
		margin-top: 4px;
	}

	.switch {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
	}
	.switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #cbd5e1;
		transition: 0.4s;
		border-radius: 24px;
	}
	.slider:before {
		position: absolute;
		content: '';
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.4s;
		border-radius: 50%;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}
	input:checked + .slider {
		background-color: var(--accent-red);
	}
	input:checked + .slider:before {
		transform: translateX(20px);
	}
	input:disabled + .slider {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 600px) {
		.testing-page-wrapper {
			padding: 20px 10px;
		}

		.action-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
