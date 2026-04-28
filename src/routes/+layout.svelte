<script lang="ts">
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { auth, authApi } from '$lib/firebase';

	let { children } = $props();

	// --- Dropdown & User States ---
	let isDropdownOpen = $state(false);
	let isAuthenticated = $state(false); // NEW: Track authentication status
	let userDisplayName = $state('Energy Tracker User');
	let userEmail = $state('Loading...');

	function toggleDropdown(e: Event) {
		e.stopPropagation();
		isDropdownOpen = !isDropdownOpen;
	}

	async function logout() {
		await authApi.signOut(auth);
		document.cookie = 'ets_auth=; Path=/; Max-Age=0; SameSite=Lax';
		if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('ets-authenticated');
		goto('/login');
	}

	onMount(() => {
		const unsubAuth = authApi.onAuthStateChanged(auth, (user) => {
			if (user) {
				isAuthenticated = true; // Show Navbar
				userDisplayName = user.displayName || 'Energy Tracker User';
				userEmail = user.email || 'No email provided';
			} else {
				isAuthenticated = false; // Hide Navbar on Login page
			}
		});

		// GLOBALLY INITIALIZE THE THEME ON MOUNT
		const theme = localStorage.getItem('ets-theme') || 'system';
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

		function applyTheme(t: string) {
			if (t === 'dark' || (t === 'system' && prefersDark.matches)) {
				document.documentElement.setAttribute('data-theme', 'dark');
			} else {
				document.documentElement.setAttribute('data-theme', 'light');
			}
		}

		applyTheme(theme);

		prefersDark.addEventListener('change', () => {
			if (localStorage.getItem('ets-theme') === 'system') {
				applyTheme('system');
			}
		});

		return () => {
			if (unsubAuth) unsubAuth();
		};
	});
</script>

<svelte:window onclick={() => (isDropdownOpen = false)} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<link
		rel="stylesheet"
		href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
	/>
</svelte:head>

{#if isAuthenticated}
	<div class="top-nav no-print">
		<button class="brand-link" onclick={() => window.location.assign('/')}>
			<img src="/logo.png" alt="Logo" class="nav-logo" />
			<h1 class="brand-title">Energy Tracking System</h1>
		</button>

		<div class="nav-actions relative">
			<button class="profile-toggle" onclick={toggleDropdown}>
				<div class="avatar"><i class="fas fa-user"></i></div>
				<span class="user-name">{userDisplayName}</span>
				<i
					class="fas fa-chevron-down"
					style="font-size: 12px; margin-left: 5px; color: var(--text-muted);"
				></i>
			</button>

			{#if isDropdownOpen}
				<div class="profile-dropdown">
					<div class="dropdown-header">
						<span class="fw-bold">{userDisplayName}</span>
						<span class="text-sm">{userEmail}</span>
					</div>
					<div class="dropdown-divider"></div>

					<button
						class="dropdown-item"
						onclick={() => {
							goto('/about');
							isDropdownOpen = false;
						}}
					>
						<i class="fas fa-info-circle"></i> About
					</button>

					<button
						class="dropdown-item"
						onclick={() => {
							goto('/testing');
							isDropdownOpen = false;
						}}
					>
						<i class="fas fa-vial"></i> Manual Testing
					</button>

					<button
						class="dropdown-item"
						onclick={() => {
							goto('/settings');
							isDropdownOpen = false;
						}}
					>
						<i class="fas fa-cog"></i> Settings
					</button>

					<div class="dropdown-divider"></div>

					<button class="dropdown-item text-red" onclick={logout}>
						<i class="fas fa-sign-out-alt"></i> Logout
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<main class="page-content">
	{@render children()}
</main>

<style>
	/* =========================================
	   MASTER THEME VARIABLES (GLOBAL)
	   ========================================= */
	:global(:root) {
		--primary: #2e8b57;
		--primary-dark: #226b42;
		--accent-red: #d32f2f;

		--bg-color: #f4f7fa;
		--card-bg: #ffffff;
		--border: #e6ece8;
		--text-main: #2d3748;
		--text-muted: #718096;
		--input-bg: #f8fafc;
		--hover-bg: #edf2f7;

		--nav-bg: rgba(255, 255, 255, 0.85);
		--body-bg:
			radial-gradient(1400px 500px at 0% -10%, #e9f7ee 0%, transparent 65%),
			linear-gradient(180deg, #f6fbf8 0%, #eef4f1 100%);
	}

	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	:global(html[data-theme='dark']) {
		--primary: #3cb371;
		--primary-dark: #2e8b57;
		--accent-red: #ef5350;

		--bg-color: #0f172a;
		--card-bg: #1e293b;
		--border: #334155;
		--text-main: #f8fafc;
		--text-muted: #94a3b8;
		--input-bg: #0f172a;
		--hover-bg: #334155;

		--nav-bg: rgba(30, 41, 59, 0.85);
		--body-bg: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
	}

	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background: var(--body-bg);
		color: var(--text-main);
		min-height: 100vh;
		transition:
			background 0.3s,
			color 0.3s;
	}

	/* Top Navigation */
	.top-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 15px 30px;
		background: var(--nav-bg);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-logo {
		height: 40px;
	}
	.nav-actions {
		display: flex;
		gap: 10px;
	}

	.brand-link {
		display: flex;
		align-items: center;
		gap: 12px;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
		text-align: left;
	}
	.brand-title {
		margin: 0;
		font-size: 20px;
		font-weight: 800;
		color: var(--text-main);
		text-transform: uppercase;
	}

	/* Profile Dropdown Styles */
	.relative {
		position: relative;
	}

	.profile-toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		background: transparent;
		border: 1px solid var(--border);
		padding: 6px 16px 6px 6px;
		border-radius: 30px;
		cursor: pointer;
		color: var(--text-main);
		font-weight: 600;
		transition: all 0.2s;
	}
	.profile-toggle:hover {
		background: var(--input-bg);
		border-color: var(--border);
	}

	.avatar {
		background: var(--primary);
		color: white;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
	}

	.profile-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 10px;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
		min-width: 240px;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: slideDown 0.2s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.dropdown-header {
		padding: 16px;
		background: var(--input-bg);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.dropdown-header .fw-bold {
		font-weight: 800;
		font-size: 14px;
		color: var(--text-main);
	}
	.dropdown-header .text-sm {
		font-size: 12px;
		color: var(--text-muted);
	}

	.dropdown-divider {
		height: 1px;
		background: var(--border);
		margin: 0;
	}

	.dropdown-item {
		padding: 12px 16px;
		background: none;
		border: none;
		text-align: left;
		width: 100%;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-main);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 12px;
		transition: background 0.2s;
	}
	.dropdown-item i {
		color: var(--text-muted);
		width: 16px;
		text-align: center;
	}
	.dropdown-item:hover {
		background: var(--hover-bg);
		color: var(--primary-dark);
	}
	.dropdown-item:hover i {
		color: var(--primary);
	}

	.dropdown-item.text-red {
		color: var(--accent-red);
	}
	.dropdown-item.text-red i {
		color: var(--accent-red);
	}
	.dropdown-item.text-red:hover {
		background: rgba(211, 47, 47, 0.1);
	}

	@media print {
		.no-print {
			display: none !important;
		}
	}

	/* Mobile Navigation Responsiveness */
	@media (max-width: 768px) {
		.top-nav {
			padding: 16px 20px;
			min-height: 70px;
		}

		.brand-title,
		.user-name,
		.fa-chevron-down {
			display: none;
		}

		.nav-logo {
			height: 35px;
			width: auto;
		}

		.profile-toggle {
			padding: 0;
			border: none;
			background: transparent;
		}

		.avatar {
			width: 38px;
			height: 38px;
			font-size: 16px;
		}

		.profile-dropdown {
			right: 20px;
			top: 75px;
			width: 220px;
		}
	}
</style>
