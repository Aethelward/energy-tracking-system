<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth, authApi, dbApi, mainDb, type User } from '$lib/firebase';
	import { onMount } from 'svelte';

	// --- Profile & Threshold States ---
	let currentUser: User | null = null;
	let username = '';
	let password = '';
	let minVolt = '';
	let maxVolt = '';
	let minAmp = '';
	let maxAmp = '';
	let minPower = '';
	let maxPower = '';
	let muteAlerts = false;

	// --- Notifications ---
	let notificationEmail = '';
	let notificationPhone = '';
	let reminderTime1 = '18:00';
	let reminderTime2 = '19:00';

	// --- Device Config States ---
	let showModal = false;
	let checkGround = true;
	let checkSecond = true;
	let checkThird = false;
	let groundPanels = [true, false, false, false, false];
	let secondPanels = [true, false, false, false, false];
	let thirdPanels = [false, false, false, false, false];

	// --- Theme State ---
	let selectedTheme: 'system' | 'light' | 'dark' = 'system';

	// --- Functions ---
	async function loadThresholds() {
		const snap = await dbApi.get(dbApi.ref(mainDb, 'thresholds'));
		const data = snap.val();
		if (!data) return;
		minVolt = data.voltage?.min?.toString() ?? '';
		maxVolt = data.voltage?.max?.toString() ?? '';
		minAmp = data.current?.min?.toString() ?? '';
		maxAmp = data.current?.max?.toString() ?? '';
		minPower = data.power?.min?.toString() ?? '';
		maxPower = data.power?.max?.toString() ?? '';
		muteAlerts = Boolean(data.muted);

		const notifSnap = await dbApi.get(dbApi.ref(mainDb, 'notifications'));
		const notifData = notifSnap.val();
		if (notifData) {
			notificationEmail = notifData.email ?? '';
			notificationPhone = notifData.phone ?? '';
			reminderTime1 = notifData.reminders?.[0] ?? '18:00';
			reminderTime2 = notifData.reminders?.[1] ?? '19:00';
		}
	}

	async function saveAlertThresholds() {
		await dbApi.set(dbApi.ref(mainDb, 'thresholds'), {
			voltage: { min: Number(minVolt || 0), max: Number(maxVolt || 0) },
			current: { min: Number(minAmp || 0), max: Number(maxAmp || 0) },
			power: { min: Number(minPower || 0), max: Number(maxPower || 0) },
			muted: muteAlerts
		});
		alert('Firebase: Thresholds Updated!');
	}

	async function saveNotificationSettings() {
		await dbApi.set(dbApi.ref(mainDb, 'notifications'), {
			email: notificationEmail,
			phone: notificationPhone,
			reminders: [reminderTime1, reminderTime2]
		});
		alert('Firebase: Notification Settings Updated!');
	}

	async function saveProfile() {
		// Use the stored currentUser instead of auth.currentUser
		if (!currentUser) {
			alert('No authenticated user found.');
			return;
		}

		try {
			if (username) {
				await authApi.updateProfile(currentUser, { displayName: username });
			}

			if (password) {
				await authApi.updatePassword(currentUser, password);
				password = ''; // Clear the password field after saving
			}

			alert('Profile updated successfully.');
		} catch (error: any) {
			console.error('Profile update error:', error);
			// Firebase requires users to have logged in recently to change passwords
			if (error.code === 'auth/requires-recent-login') {
				alert('For security reasons, please log out and log back in to change your password.');
			} else {
				alert('Failed to update profile: ' + error.message);
			}
		}
	}

	// --- Theme Logic ---
	function applyTheme(theme: string) {
		if (
			theme === 'dark' ||
			(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
		) {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.setAttribute('data-theme', 'light');
		}
	}

	function handleThemeChange() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('ets-theme', selectedTheme);
			applyTheme(selectedTheme);
		}
	}

	// --- Device Config Logic ---
	function loadDeviceConfig() {
		if (typeof localStorage === 'undefined') return;
		const saved = localStorage.getItem('energyTrackerConfig');
		if (!saved) return;
		const config = JSON.parse(saved);
		checkGround = Boolean(config?.ground?.enabled);
		checkSecond = Boolean(config?.second?.enabled);
		checkThird = Boolean(config?.third?.enabled);
		groundPanels = config?.ground?.panels ?? groundPanels;
		secondPanels = config?.second?.panels ?? secondPanels;
		thirdPanels = config?.third?.panels ?? thirdPanels;
	}

	function saveDeviceConfig() {
		if (typeof localStorage === 'undefined') return;
		const config = {
			ground: { enabled: checkGround, panels: groundPanels },
			second: { enabled: checkSecond, panels: secondPanels },
			third: { enabled: checkThird, panels: thirdPanels }
		};
		localStorage.setItem('energyTrackerConfig', JSON.stringify(config));
		showModal = false;
		alert('Device configuration saved.');
	}

	function updatePanel(floor: 'ground' | 'second' | 'third', idx: number, checked: boolean) {
		if (floor === 'ground') {
			groundPanels[idx] = checked;
			groundPanels = [...groundPanels];
			return;
		}
		if (floor === 'second') {
			secondPanels[idx] = checked;
			secondPanels = [...secondPanels];
			return;
		}
		thirdPanels[idx] = checked;
		thirdPanels = [...thirdPanels];
	}

	onMount(() => {
		// Load Theme
		if (typeof localStorage !== 'undefined') {
			selectedTheme =
				(localStorage.getItem('ets-theme') as 'system' | 'light' | 'dark') || 'system';
			applyTheme(selectedTheme);
		}

		void loadThresholds();
		loadDeviceConfig();

		const unsub = authApi.onAuthStateChanged(auth, (user: User | null) => {
			currentUser = user; // <-- ADD THIS
			if (user?.displayName) username = user.displayName;
		});
		return unsub;
	});
</script>

<svelte:head>
	<title>Settings - Energy Tracking System</title>
</svelte:head>

<div class="settings-page-wrapper">
	<div class="settings-container">
		<button class="back-btn" onclick={() => goto('/')}>
			<i class="fas fa-arrow-left"></i> Back to Dashboard
		</button>

		<div class="settings-header">
			<h1>Settings & Configuration</h1>
			<p>Manage your account, display preferences, and hardware connectivity.</p>
		</div>

		<div class="settings-card">
			<div class="card-title"><i class="fas fa-paint-brush"></i> Appearance</div>
			<p class="subtitle">Customize the dashboard interface.</p>

			<label for="themeSelect">Interface Theme</label>
			<select
				id="themeSelect"
				bind:value={selectedTheme}
				onchange={handleThemeChange}
				class="styled-input"
			>
				<option value="system">System Default</option>
				<option value="light">Light Mode</option>
				<option value="dark">Dark Mode</option>
			</select>
		</div>

		<div class="settings-card">
			<div class="card-title"><i class="fas fa-user-circle"></i> Profile</div>
			<p class="subtitle">Update your personal account details.</p>

			<label for="username">Display Name</label>
			<input
				id="username"
				class="styled-input"
				type="text"
				bind:value={username}
				placeholder="Loading name..."
			/>

			<label for="password">New Password</label>
			<input
				id="password"
				class="styled-input"
				type="password"
				bind:value={password}
				placeholder="Enter new password (optional)"
			/>

			<button class="action-btn btn-primary" onclick={saveProfile}>
				<i class="fas fa-save"></i> Save Profile Changes
			</button>
		</div>

		<div class="settings-card">
			<div class="card-title"><i class="fas fa-bell"></i> Notification Settings</div>
			<p class="subtitle">Configure where and when you receive alerts.</p>

			<label for="notifEmail">Email Address</label>
			<input
				id="notifEmail"
				class="styled-input"
				type="email"
				bind:value={notificationEmail}
				placeholder="yourname@example.com"
			/>

			<label for="notifPhone">Phone Number</label>
			<input
				id="notifPhone"
				class="styled-input"
				type="tel"
				bind:value={notificationPhone}
				placeholder="+63 900 000 0000"
			/>

			<div class="threshold-grid">
				<div>
					<label for="reminder1">Reminder Time 1</label>
					<input id="reminder1" class="styled-input" type="time" bind:value={reminderTime1} />
				</div>
				<div>
					<label for="reminder2">Reminder Time 2</label>
					<input id="reminder2" class="styled-input" type="time" bind:value={reminderTime2} />
				</div>
			</div>

			<button class="action-btn btn-primary" onclick={saveNotificationSettings}>
				<i class="fas fa-save"></i> Save Notification Settings
			</button>
		</div>

		<div class="settings-card danger-card">
			<div class="card-title danger-text">
				<i class="fas fa-exclamation-triangle"></i> Hardware Thresholds
			</div>
			<p class="subtitle">
				Limits are saved directly to Firebase and synced to all dashboard instances.
			</p>

			<div class="toggle-container">
				<div class="toggle-info">
					<strong class="danger-text">Mute All Alert Logs</strong>
					<span class="text-sm">Temporarily silence browser and dashboard popups.</span>
				</div>
				<label class="switch">
					<input type="checkbox" bind:checked={muteAlerts} />
					<span class="slider round"></span>
				</label>
			</div>

			<label>Voltage Threshold (V)</label>
			<div class="threshold-grid">
				<input class="styled-input" type="number" bind:value={minVolt} placeholder="Min (V)" />
				<input class="styled-input" type="number" bind:value={maxVolt} placeholder="Max (V)" />
			</div>

			<label>Current Threshold (A)</label>
			<div class="threshold-grid">
				<input class="styled-input" type="number" bind:value={minAmp} placeholder="Min (A)" />
				<input class="styled-input" type="number" bind:value={maxAmp} placeholder="Max (A)" />
			</div>

			<label>Power Threshold (W)</label>
			<div class="threshold-grid">
				<input class="styled-input" type="number" bind:value={minPower} placeholder="Min (W)" />
				<input class="styled-input" type="number" bind:value={maxPower} placeholder="Max (W)" />
			</div>

			<button class="action-btn btn-red mt-2" onclick={saveAlertThresholds}>
				<i class="fas fa-cloud-upload-alt"></i> Sync Limits to Cloud
			</button>
		</div>

		<div class="settings-card">
			<div class="card-title"><i class="fas fa-server"></i> Device Connectivity</div>
			<p class="subtitle">Manage local display elements and active monitoring floors.</p>

			<div class="threshold-grid mt-2">
				<button class="action-btn btn-outline" onclick={() => (showModal = true)}>
					<i class="fas fa-sliders-h"></i> Manage Devices
				</button>
				<button class="action-btn btn-soft" onclick={() => goto('/about')}>
					<i class="fas fa-circle-info"></i> About System
				</button>
			</div>
		</div>
	</div>
</div>

{#if showModal}
	<div class="modal">
		<div class="modal-content">
			<button class="close" onclick={() => (showModal = false)}>&times;</button>
			<div class="card-title" style="margin-bottom: 5px;">Configure Local Devices</div>
			<p class="subtitle">Select floors and active panel boxes to display.</p>

			<div class="floor-group">
				<label class="floor-header">
					<input type="checkbox" bind:checked={checkGround} /> Ground Floor
				</label>
				{#if checkGround}
					<div class="panel-options">
						{#each [1, 2, 3, 4, 5] as panel, i}
							<label class="panel-option">
								<input
									type="checkbox"
									checked={groundPanels[i]}
									onchange={(e) =>
										updatePanel('ground', i, (e.currentTarget as HTMLInputElement).checked)}
								/>
								Panel {panel}
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<div class="floor-group">
				<label class="floor-header">
					<input type="checkbox" bind:checked={checkSecond} /> Second Floor
				</label>
				{#if checkSecond}
					<div class="panel-options">
						{#each [1, 2, 3, 4, 5] as panel, i}
							<label class="panel-option">
								<input
									type="checkbox"
									checked={secondPanels[i]}
									onchange={(e) =>
										updatePanel('second', i, (e.currentTarget as HTMLInputElement).checked)}
								/>
								Panel {panel}
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<div class="floor-group">
				<label class="floor-header">
					<input type="checkbox" bind:checked={checkThird} /> Third Floor
				</label>
				{#if checkThird}
					<div class="panel-options">
						{#each [1, 2, 3, 4, 5] as panel, i}
							<label class="panel-option">
								<input
									type="checkbox"
									checked={thirdPanels[i]}
									onchange={(e) =>
										updatePanel('third', i, (e.currentTarget as HTMLInputElement).checked)}
								/>
								Panel {panel}
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<button class="action-btn btn-primary mt-2" onclick={saveDeviceConfig}
				>Save Configuration</button
			>
		</div>
	</div>
{/if}

<style>
	/* CSS Variables for Dynamic Theming */
	:global(:root) {
		--bg-color: #f4f7fa;
		--card-bg: #ffffff;
		--text-main: #2d3748;
		--text-muted: #718096;
		--border-color: #e2e8f0;
		--input-bg: #f8fafc;
		--input-border: #cbd5e1;

		--primary-color: #2e8b57;
		--primary-hover: #226b42;
		--accent-red: #d32f2f;
		--red-hover: #b71c1c;
		--danger-bg: #fff5f5;
		--danger-border: #ffcdd2;
	}

	:global(html[data-theme='dark']) {
		--bg-color: #0f172a;
		--card-bg: #1e293b;
		--text-main: #f8fafc;
		--text-muted: #94a3b8;
		--border-color: #334155;
		--input-bg: #0f172a;
		--input-border: #475569;

		--danger-bg: #451a1a;
		--danger-border: #7f1d1d;
	}

	/* THIS SOLVES THE BUG!
	   We handle centering here instead of attaching it to the global body, 
	   so it safely disappears when you go back to the dashboard. */
	.settings-page-wrapper {
		display: flex;
		justify-content: center;
		padding: 40px 20px;
		width: 100%;
		box-sizing: border-box;
		min-height: calc(100vh - 70px);
		background-color: var(--bg-color);
		color: var(--text-main);
		transition:
			background-color 0.3s,
			color 0.3s;
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
		transition:
			background-color 0.3s,
			border-color 0.3s;
	}

	.danger-card {
		border-top: 4px solid var(--accent-red);
	}
	.danger-text {
		color: var(--accent-red) !important;
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

	label {
		display: block;
		font-weight: 600;
		margin-bottom: 8px;
		color: var(--text-main);
		font-size: 13px;
	}

	.styled-input {
		width: 100%;
		padding: 12px 14px;
		font-size: 14px;
		border-radius: 8px;
		border: 1px solid var(--input-border);
		background-color: var(--input-bg);
		color: var(--text-main);
		box-sizing: border-box;
		margin-bottom: 18px;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	.styled-input:focus {
		outline: none;
		border-color: var(--primary-color);
		box-shadow: 0 0 0 3px rgba(46, 139, 87, 0.1);
	}
	select.styled-input {
		appearance: auto;
		cursor: pointer;
	}

	.threshold-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 15px;
		margin-bottom: 6px;
	}

	.mt-2 {
		margin-top: 15px;
	}

	.action-btn {
		width: 100%;
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
	.btn-primary:hover {
		background-color: var(--primary-hover);
		transform: translateY(-1px);
	}

	.btn-red {
		background-color: var(--accent-red);
		color: white;
	}
	.btn-red:hover {
		background-color: var(--red-hover);
		transform: translateY(-1px);
	}

	.btn-outline {
		background: transparent;
		border: 1px solid var(--border-color);
		color: var(--text-main);
	}
	.btn-outline:hover {
		background: var(--input-bg);
	}

	.btn-soft {
		background: rgba(46, 139, 87, 0.1);
		color: var(--primary-color);
	}
	.btn-soft:hover {
		background: rgba(46, 139, 87, 0.2);
	}

	/* Toggle Switch */
	.toggle-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--danger-bg);
		padding: 15px 18px;
		border-radius: 8px;
		margin-bottom: 22px;
		border: 1px solid var(--danger-border);
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

	/* Modal */
	.modal {
		position: fixed;
		z-index: 1000;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 20px;
	}

	.modal-content {
		background: var(--card-bg);
		padding: 30px;
		border-radius: 16px;
		width: 100%;
		max-width: 500px;
		border: 1px solid var(--border-color);
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
		max-height: 90vh;
		overflow-y: auto;
	}

	.close {
		float: right;
		font-size: 28px;
		cursor: pointer;
		border: none;
		background: transparent;
		color: var(--text-muted);
		line-height: 1;
	}
	.close:hover {
		color: var(--text-main);
	}

	.floor-group {
		border: 1px solid var(--border-color);
		background: var(--input-bg);
		border-radius: 8px;
		padding: 15px;
		margin-bottom: 15px;
	}

	.floor-header {
		display: flex;
		align-items: center;
		font-weight: 700;
		font-size: 15px;
		margin-bottom: 10px;
		gap: 10px;
		margin-top: 0;
		cursor: pointer;
	}

	.panel-options {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.panel-option {
		background: var(--card-bg);
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 600;
		display: flex;
		align-items: center;
		border: 1px solid var(--border-color);
		gap: 8px;
		cursor: pointer;
		transition: border-color 0.2s;
	}
	.panel-option:hover {
		border-color: var(--primary-color);
	}
</style>
