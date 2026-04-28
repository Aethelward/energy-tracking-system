<svelte:options runes={false} />

<script lang="ts">
	import { PUBLIC_FIREBASE_VAPID_KEY } from '$env/static/public';
	import { auth, authApi, dbApi, mainDb, mainApp, messagingApi } from '$lib/firebase';

	const VAPID_KEY = PUBLIC_FIREBASE_VAPID_KEY;

	let email = '';
	let password = '';
	let remember = false;
	let loading = false;
	let errorMsg = '';
	let showNotificationModal = false;
	let swRegistration: ServiceWorkerRegistration | null = null;

	if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
		navigator.serviceWorker
			.register('/firebase-messaging-sw.js')
			.then((registration) => {
				swRegistration = registration;
			})
			.catch((error) => {
				console.error('Service Worker registration failed:', error);
			});
	}

	async function handleLogin(event?: SubmitEvent) {
		event?.preventDefault();
		errorMsg = '';
		if (!email || !password) {
			errorMsg = 'Please enter both email and password.';
			return;
		}

		loading = true;
		try {
			await authApi.signInWithEmailAndPassword(auth, email, password);
			const uid = auth.currentUser?.uid;
			if (uid) {
				const notifSnap = await dbApi.get(dbApi.ref(mainDb, `users/${uid}/notifications`));
				const notifData = notifSnap.val();
				if (notifData && (notifData.enableSms || notifData.enableEmail)) {
					await finishLogin();
					loading = false;
					return;
				}
			}
			showNotificationModal = true;
		} catch (error: unknown) {
			const code = (error as { code?: string })?.code;
			if (code === 'auth/user-not-found') errorMsg = 'No user found in this project.';
			else if (code === 'auth/wrong-password') errorMsg = 'Incorrect password.';
			else if (code === 'auth/invalid-email') errorMsg = 'Invalid email format.';
			else errorMsg = 'Login failed.';
		} finally {
			loading = false;
		}
	}

	async function enableNotifications() {
		try {
			const uid = auth.currentUser?.uid;
			if (uid) {
				await dbApi.update(dbApi.ref(mainDb, `users/${uid}/notifications`), {
					enableSms: true,
					enableEmail: true
				});
			}

			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				alert(
					'Browser push notifications denied. You will still receive SMS/Email alerts if configured.'
				);
				await finishLogin();
				return;
			}

			const supported = await messagingApi.isSupported();
			if (!supported) {
				await finishLogin();
				return;
			}

			const messaging = messagingApi.getMessaging(mainApp);
			const token = await messagingApi.getToken(messaging, {
				vapidKey: VAPID_KEY,
				serviceWorkerRegistration: swRegistration ?? undefined
			});
			if (token) {
				console.log('FCM Token:', token);
			}

			alert('Notifications Active! You will receive alerts.');
		} catch (error) {
			console.error('Error retrieving token:', error);
		} finally {
			await finishLogin();
		}
	}

	async function finishLogin() {
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem('ets-authenticated', '1');
			if (remember) {
				sessionStorage.setItem('ets-remember-email', email);
			} else {
				sessionStorage.removeItem('ets-remember-email');
			}
		}
		document.cookie = 'ets_auth=1; Path=/; SameSite=Lax';
		showNotificationModal = false;
		window.location.assign('/');
	}

	if (typeof sessionStorage !== 'undefined') {
		const remembered = sessionStorage.getItem('ets-remember-email');
		if (remembered) {
			email = remembered;
			remember = true;
		}
	}
</script>

<svelte:head>
	<title>Energy Tracking System Login</title>
</svelte:head>

<div class="login-page-wrapper">
	<div class="login-container" class:fade-away={showNotificationModal}>
		<div class="left-panel">
			<img src="/logo.png" alt="Energy Tracking System Logo" class="logo" />
			<h1>Energy Tracking System</h1>
			<p>FOR A BETTER TOMORROW, SAVE ENERGY TODAY.</p>
		</div>

		<div class="right-panel">
			<form onsubmit={handleLogin}>
				{#if errorMsg}
					<div class="error-msg">{errorMsg}</div>
				{/if}

				<div class="form-group">
					<label for="email" class="form-label">Email</label>
					<input
						type="email"
						id="email"
						class="form-input"
						bind:value={email}
						placeholder="Enter email"
					/>
				</div>

				<div class="form-group">
					<label for="password" class="form-label">Password</label>
					<input
						type="password"
						id="password"
						class="form-input"
						bind:value={password}
						placeholder="Enter password"
					/>
				</div>

				<div class="remember-me">
					<input type="checkbox" id="remember" bind:checked={remember} class="custom-checkbox" />
					<label for="remember">Remember Me</label>
				</div>

				<button type="submit" class="login-button" disabled={loading}>
					{loading ? 'Authenticating...' : 'Login'}
				</button>

				<p class="footer-text">
					Don't have an account? Contact<br />
					<a href="mailto:Etrackeradmin@gmail.com">Etrackeradmin@gmail.com</a>
				</p>
			</form>
		</div>
	</div>
</div>

{#if showNotificationModal}
	<div class="notif-overlay">
		<div class="notif-box">
			<div class="notif-icon">🔔</div>
			<h2>Enable Critical Alerts</h2>
			<p>Please review the terms below.</p>

			<div class="term-box">
				<strong>TERMS AND CONDITIONS FOR ALERTS</strong><br /><br />
				By clicking "Enable", you allow the Energy Tracking System to send notifications to this device.<br
				/><br />
				1. <strong>Offline Delivery:</strong> Alerts may be delivered even if you are logged out.<br
				/>
				2. <strong>Safety:</strong> These alerts are informational and not a replacement for fire
				safety systems.<br />
				3. <strong>Privacy:</strong> We use anonymous device tokens to route notifications.<br />
				4. <strong>Opt-Out:</strong> You can disable notifications in browser settings at any time.<br
				/>
			</div>

			<button class="btn-agree" onclick={enableNotifications}
				>I Agree and Enable Notifications</button
			>
			<button class="btn-skip" onclick={finishLogin}>Skip and go to Dashboard</button>
		</div>
	</div>
{/if}

<style>
	/* Wrapper handles centering so layout.svelte controls the background theme smoothly */
	.login-page-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: calc(100vh - 40px);
		padding: 20px;
		box-sizing: border-box;
	}

	.login-container {
		display: flex;
		width: 1000px;
		max-width: 100%;
		min-height: 600px;
		background-color: var(--card-bg);
		border-radius: 20px;
		box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
		border: 1px solid var(--border);
		overflow: hidden;
		transition: opacity 0.3s;
	}

	.fade-away {
		opacity: 0.2;
		pointer-events: none;
	}

	.left-panel {
		flex: 1;
		background-color: var(--hover-bg);
		padding: 60px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		color: var(--primary);
	}

	.logo {
		width: 150px;
		height: auto;
		margin-bottom: 30px;
	}

	.left-panel h1 {
		font-size: 36px;
		margin-bottom: 15px;
		font-weight: 900;
	}

	.left-panel p {
		font-size: 16px;
		font-weight: 700;
		max-width: 350px;
		color: var(--text-main);
	}

	.right-panel {
		flex: 1;
		padding: 60px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.form-group {
		margin-bottom: 25px;
	}

	.form-label {
		display: block;
		margin-bottom: 10px;
		font-weight: 600;
		color: var(--text-main);
	}

	.form-input {
		width: 100%;
		padding: 15px 18px;
		border: 1px solid var(--border);
		background-color: var(--input-bg);
		color: var(--text-main);
		border-radius: 8px;
		box-sizing: border-box;
		font-size: 16px;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(46, 139, 87, 0.1);
	}

	.remember-me {
		display: flex;
		align-items: center;
		margin-bottom: 30px;
		gap: 10px;
		color: var(--text-main);
		font-weight: 600;
	}

	.custom-checkbox {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: var(--primary);
	}

	.login-button {
		width: 100%;
		padding: 15px;
		background-color: var(--primary);
		border: none;
		border-radius: 8px;
		color: white;
		font-size: 18px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.login-button:hover:not(:disabled) {
		background-color: var(--primary-dark);
	}

	.login-button:disabled {
		background-color: var(--text-muted);
		cursor: not-allowed;
		opacity: 0.7;
	}

	.footer-text {
		text-align: center;
		margin-top: 30px;
		font-size: 14px;
		color: var(--text-muted);
		line-height: 1.6;
	}

	.footer-text a {
		color: var(--primary);
		text-decoration: none;
		font-weight: 600;
	}

	.error-msg {
		background-color: rgba(211, 47, 47, 0.1);
		color: var(--accent-red);
		border: 1px solid rgba(211, 47, 47, 0.3);
		padding: 12px;
		border-radius: 8px;
		margin-bottom: 20px;
		text-align: center;
		font-weight: bold;
		font-size: 14px;
	}

	.notif-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		z-index: 2000;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.notif-box {
		background: var(--card-bg);
		color: var(--text-main);
		width: 90%;
		max-width: 500px;
		padding: 40px;
		border-radius: 15px;
		text-align: center;
		border-top: 10px solid var(--primary);
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.notif-box h2 {
		margin-top: 10px;
		margin-bottom: 5px;
	}

	.notif-icon {
		font-size: 42px;
	}

	.term-box {
		background: var(--input-bg);
		border: 1px solid var(--border);
		color: var(--text-muted);
		padding: 18px;
		margin: 20px 0;
		border-radius: 8px;
		text-align: left;
		font-size: 13px;
		line-height: 1.5;
		max-height: 250px;
		overflow-y: auto;
	}

	.btn-agree {
		background: var(--primary);
		color: white;
		padding: 14px 25px;
		border: none;
		border-radius: 8px;
		font-size: 15px;
		cursor: pointer;
		font-weight: bold;
		width: 100%;
		transition: background-color 0.2s;
	}

	.btn-agree:hover {
		background: var(--primary-dark);
	}

	.btn-skip {
		background: transparent;
		color: var(--text-muted);
		border: none;
		margin-top: 18px;
		cursor: pointer;
		font-weight: 600;
		font-size: 14px;
		transition: color 0.2s;
	}

	.btn-skip:hover {
		color: var(--text-main);
	}

	@media (max-width: 900px) {
		.login-container {
			flex-direction: column;
			max-width: 500px;
		}
		.left-panel {
			padding: 40px 20px;
		}
		.right-panel {
			padding: 40px 30px;
		}
	}
</style>
