<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<svelte:head>
	<title>About - Energy Tracking System</title>
</svelte:head>

<div class="about-page-wrapper">
	<div class="container">
		<button class="back-btn" onclick={() => goto('/settings')}>
			<i class="fas fa-arrow-left"></i> Back to Settings
		</button>

		<h1>About Energy Tracking System</h1>

		<p>
			The <strong>Energy Tracking System (ETRACKER)</strong> is a smart electricity tracking and monitoring
			system built to help users visualize and understand power usage in real time.
		</p>

		<p>
			It allows users to track voltage, current, and power data on each floor of a building, helping
			to improve energy efficiency, prevent damage from electrical faults, and support safety
			compliance.
		</p>

		<h2>Features</h2>
		<ul>
			<li>Real-time monitoring of voltage, current, and power</li>
			<li>Live graph display of historical power usage</li>
			<li>Threshold alerts for undervoltage and overvoltage</li>
			<li>Multi-floor support (for example, Ground and Second floor)</li>
			<li>Secure user authentication with Firebase</li>
			<li>Responsive design for desktops and tablets</li>
		</ul>

		<h2>Version</h2>
		<p>ETRACKER Version 1.0</p>

		<h2>Developed By</h2>
		<p>CNSC Electrical Engineering Student</p>
		<p>Email: <a href="mailto:etracker@gmail.com">etracker@gmail.com</a></p>

		<h2>Location</h2>
		<p>Engineering Building, Camarines Norte State College</p>
		<p>Daet, Camarines Norte, Philippines</p>
	</div>
</div>

<style>
	/* Wrapper handles centering so layout controls the background theme smoothly */
	.about-page-wrapper {
		display: flex;
		justify-content: center;
		padding: 40px 20px;
		width: 100%;
		box-sizing: border-box;
	}

	.container {
		width: 100%;
		max-width: 850px;
		padding: 40px;
		background-color: var(--card-bg);
		border-radius: 16px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
		border: 1px solid var(--border);
		color: var(--text-main);
		line-height: 1.6;
		font-size: 16px;
	}

	.back-btn {
		background: var(--input-bg);
		color: var(--text-main);
		border: 1px solid var(--border);
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		margin-bottom: 20px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.back-btn:hover {
		background: var(--border);
		transform: translateY(-1px);
	}

	h1 {
		text-align: center;
		font-size: 2.2em;
		color: var(--primary);
		margin-top: 10px;
		margin-bottom: 30px;
		font-weight: 900;
	}

	h2 {
		color: var(--primary);
		margin-top: 35px;
		margin-bottom: 15px;
		border-bottom: 2px solid var(--border);
		padding-bottom: 8px;
		font-weight: 700;
	}

	ul {
		padding-left: 20px;
		color: var(--text-main);
	}

	li {
		margin-bottom: 10px;
	}

	a {
		color: var(--primary);
		text-decoration: none;
		font-weight: 600;
		transition: color 0.2s;
	}

	a:hover {
		color: var(--primary-dark);
		text-decoration: underline;
	}
</style>
