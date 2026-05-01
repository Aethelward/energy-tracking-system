<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth, authApi, dbApi, mainDb, type User } from '$lib/firebase';
	import { onMount } from 'svelte';

	// --- Profile & Threshold States ---
	let currentUser: User | null = null;
	let username = '';

	// --- Password Modal States ---
	let showPasswordModal = false;
	let currentPassword = '';
	let newPassword = '';
	let confirmPassword = '';
	let passwordUpdateError = '';

	// --- Threshold States ---
	let minVolt = '';
	let maxVolt = '';
	let enableVolt = true;
	let minAmp = '';
	let maxAmp = '';
	let enableAmp = true;
	let minPower = '';
	let maxPower = '';
	let enablePower = true;

	// --- Notifications ---
	let notificationEmail = '';
	let notificationPhone = '';
	let enableSms = true;
	let enableEmail = true;
	let threshStartTime = '00:00';
	let threshEndTime = '23:59';
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
		enableVolt = data.voltage?.enabled ?? true;
		minAmp = data.current?.min?.toString() ?? '';
		maxAmp = data.current?.max?.toString() ?? '';
		enableAmp = data.current?.enabled ?? true;
		minPower = data.power?.min?.toString() ?? '';
		maxPower = data.power?.max?.toString() ?? '';
		enablePower = data.power?.enabled ?? true;
	}

	async function loadNotifications(uid: string) {
		const notifSnap = await dbApi.get(dbApi.ref(mainDb, `users/${uid}/notifications`));
		const notifData = notifSnap.val();
		if (notifData) {
			notificationEmail = notifData.email ?? '';
			notificationPhone = notifData.phone ?? '';
			enableSms = notifData.enableSms ?? true;
			enableEmail = notifData.enableEmail ?? true;
			threshStartTime = notifData.threshStartTime ?? '00:00';
			threshEndTime = notifData.threshEndTime ?? '23:59';
			reminderTime1 = notifData.reminders?.[0] ?? '18:00';
			reminderTime2 = notifData.reminders?.[1] ?? '19:00';
		}
	}

	async function saveAlertThresholds() {
		await dbApi.set(dbApi.ref(mainDb, 'thresholds'), {
			voltage: { min: Number(minVolt || 0), max: Number(maxVolt || 0), enabled: enableVolt },
			current: { min: Number(minAmp || 0), max: Number(maxAmp || 0), enabled: enableAmp },
			power: { min: Number(minPower || 0), max: Number(maxPower || 0), enabled: enablePower }
		});
		alert('Firebase: Hardware Thresholds Synchronized!');
	}

	async function saveNotificationSettings() {
		if (!currentUser) {
			alert('Must be logged in to save personal settings.');
			return;
		}
		await dbApi.set(dbApi.ref(mainDb, `users/${currentUser.uid}/notifications`), {
			email: notificationEmail,
			phone: notificationPhone,
			enableSms,
			enableEmail,
			threshStartTime,
			threshEndTime,
			reminders: [reminderTime1, reminderTime2]
		});
		alert('Firebase: Personal Notification Settings Updated!');
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
			alert('Profile updated successfully.');
		} catch (error: any) {
			console.error('Profile update error:', error);
			alert('Failed to update profile: ' + error.message);
		}
	}

	async function updatePasswordProcess() {
		if (!currentUser || !currentUser.email) {
			passwordUpdateError = 'User email missing.';
			return;
		}
		if (!currentPassword) {
			passwordUpdateError = 'Current password is required.';
			return;
		}
		if (newPassword !== confirmPassword) {
			passwordUpdateError = 'New passwords do not match.';
			return;
		}
		if (newPassword.length < 6) {
			passwordUpdateError = 'Password must be at least 6 characters.';
			return;
		}
		try {
			// Re-authenticate first
			await authApi.signInWithEmailAndPassword(auth, currentUser.email, currentPassword);
			// Update immediately after
			await authApi.updatePassword(currentUser, newPassword);
			alert('Password updated successfully.');
			showPasswordModal = false;
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			passwordUpdateError = '';
		} catch (e: any) {
			passwordUpdateError = e.message || 'Failed to update password.';
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
			if (user?.uid) {
				void loadNotifications(user.uid);
			}
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

			<div style="margin-top: 15px;">
				<button
					class="action-btn btn-outline"
					onclick={() => {
						showPasswordModal = true;
						passwordUpdateError = '';
					}}
				>
					<i class="fas fa-key"></i> Change Password
				</button>
			</div>

			<button class="action-btn btn-primary mt-2" onclick={saveProfile}>
				<i class="fas fa-save"></i> Save Profile Changes
			</button>
		</div>

		<div class="settings-card">
			<div class="card-title"><i class="fas fa-bell"></i> Personal Notification Settings</div>
			<p class="subtitle">
				Configure where and when you receive explicit alerts. Settings here are synced to your
				current account only.
			</p>

			<div class="toggle-container">
				<div class="toggle-info">
					<strong>Enable SMS Alerts</strong>
					<span class="text-sm">Receive alerts via text message.</span>
				</div>
				<label class="switch">
					<input type="checkbox" bind:checked={enableSms} />
					<span class="slider round"></span>
				</label>
			</div>

			<div class="toggle-container">
				<div class="toggle-info">
					<strong>Enable Email Alerts</strong>
					<span class="text-sm">Receive alerts via email.</span>
				</div>
				<label class="switch">
					<input type="checkbox" bind:checked={enableEmail} />
					<span class="slider round"></span>
				</label>
			</div>

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

			<div style="margin-top: 15px; margin-bottom: 5px;">
				<strong>Threshold Activation Range</strong>
				<p class="text-sm" style="color: var(--text-muted); margin-bottom: 10px; margin-top: 5px;">
					Thresholds notifications will ONLY trigger during this time range.
				</p>
			</div>

			<div class="threshold-grid">
				<div>
					<label for="threshStart">Start Time</label>
					<input id="threshStart" class="styled-input" type="time" bind:value={threshStartTime} />
				</div>
				<div>
					<label for="threshEnd">End Time</label>
					<input id="threshEnd" class="styled-input" type="time" bind:value={threshEndTime} />
				</div>
			</div>

			<div style="margin-top: 15px;">
				<strong>Reminder Schedule</strong>
				<p class="text-sm" style="color: var(--text-muted); margin-bottom: 10px; margin-top: 5px;">
					These reminder times are separate from the activation range above.
				</p>
				<div class="threshold-grid">
					<div>
						<label for="reminder1">Reminder Time A</label>
						<input id="reminder1" class="styled-input" type="time" bind:value={reminderTime1} />
					</div>
					<div>
						<label for="reminder2">Reminder Time B</label>
						<input id="reminder2" class="styled-input" type="time" bind:value={reminderTime2} />
					</div>
				</div>
			</div>

			<button
				class="action-btn btn-primary"
				onclick={saveNotificationSettings}
				style="margin-top: 20px;"
			>
				<i class="fas fa-save"></i> Save Notification Settings
			</button>
		</div>

		<div class="settings-card danger-card">
			<div class="card-title danger-text">
				<i class="fas fa-exclamation-triangle"></i> Hardware Thresholds
			</div>
			<p class="subtitle">
				Limits are saved directly to Firebase and synced to all tracking accounts.
			</p>

			<h4 style="margin-bottom: 8px; margin-top: 0; color: var(--text-main);">
				<div style="display:flex; justify-content:space-between; align-items:center;">
					<span>Voltage Threshold (V)</span>
					<label class="switch" style="transform: scale(0.8);">
						<input type="checkbox" bind:checked={enableVolt} />
						<span class="slider round"></span>
					</label>
				</div>
			</h4>
			<div class="threshold-grid">
				<div>
					<label for="minVolt" class="text-sm" style="color: var(--text-muted);">Minimum</label>
					<input
						id="minVolt"
						class="styled-input"
						type="number"
						bind:value={minVolt}
						placeholder="Min (V)"
					/>
				</div>
				<div>
					<label for="maxVolt" class="text-sm" style="color: var(--text-muted);">Maximum</label>
					<input
						id="maxVolt"
						class="styled-input"
						type="number"
						bind:value={maxVolt}
						placeholder="Max (V)"
					/>
				</div>
			</div>

			<h4 style="margin-bottom: 8px; margin-top: 15px; color: var(--text-main);">
				<div style="display:flex; justify-content:space-between; align-items:center;">
					<span>Current Threshold (A)</span>
					<label class="switch" style="transform: scale(0.8);">
						<input type="checkbox" bind:checked={enableAmp} />
						<span class="slider round"></span>
					</label>
				</div>
			</h4>
			<div class="threshold-grid">
				<div>
					<label for="minAmp" class="text-sm" style="color: var(--text-muted);">Minimum</label>
					<input
						id="minAmp"
						class="styled-input"
						type="number"
						bind:value={minAmp}
						placeholder="Min (A)"
					/>
				</div>
				<div>
					<label for="maxAmp" class="text-sm" style="color: var(--text-muted);">Maximum</label>
					<input
						id="maxAmp"
						class="styled-input"
						type="number"
						bind:value={maxAmp}
						placeholder="Max (A)"
					/>
				</div>
			</div>

			<h4 style="margin-bottom: 8px; margin-top: 15px; color: var(--text-main);">
				<div style="display:flex; justify-content:space-between; align-items:center;">
					<span>Power Threshold (W)</span>
					<label class="switch" style="transform: scale(0.8);">
						<input type="checkbox" bind:checked={enablePower} />
						<span class="slider round"></span>
					</label>
				</div>
			</h4>
			<div class="threshold-grid">
				<div>
					<label for="minPower" class="text-sm" style="color: var(--text-muted);">Minimum</label>
					<input
						id="minPower"
						class="styled-input"
						type="number"
						bind:value={minPower}
						placeholder="Min (W)"
					/>
				</div>
				<div>
					<label for="maxPower" class="text-sm" style="color: var(--text-muted);">Maximum</label>
					<input
						id="maxPower"
						class="styled-input"
						type="number"
						bind:value={maxPower}
						placeholder="Max (W)"
					/>
				</div>
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

{#if showPasswordModal}
	<div class="modal">
		<div class="modal-content p-4" style="max-width: 400px;">
			<button class="close" onclick={() => (showPasswordModal = false)}>&times;</button>
			<div class="card-title"><i class="fas fa-lock"></i> Change Password</div>
			{#if passwordUpdateError}
				<div class="error-msg" style="color:var(--danger-color);margin-bottom:10px;">
					{passwordUpdateError}
				</div>
			{/if}
			<div>
				<label for="currentPassword" class="text-sm">Current Password</label>
				<input
					id="currentPassword"
					class="styled-input"
					type="password"
					bind:value={currentPassword}
					placeholder="Enter current password"
				/>
			</div>
			<div class="mt-2">
				<label for="newPassword" class="text-sm">New Password</label>
				<input
					id="newPassword"
					class="styled-input"
					type="password"
					bind:value={newPassword}
					placeholder="Enter new password"
				/>
			</div>
			<div class="mt-2">
				<label for="confirmPassword" class="text-sm">Confirm New Password</label>
				<input
					id="confirmPassword"
					class="styled-input"
					type="password"
					bind:value={confirmPassword}
					placeholder="Re-enter new password"
				/>
			</div>
			<button
				class="action-btn btn-primary mt-2"
				onclick={updatePasswordProcess}
				style="width:100%"
			>
				Update Password
			</button>
		</div>
	</div>
{/if}

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

	@media (max-width: 600px) {
		.settings-page-wrapper {
			padding: 20px 10px;
		}

		.threshold-grid {
			grid-template-columns: 1fr;
			gap: 10px;
		}

		.action-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
