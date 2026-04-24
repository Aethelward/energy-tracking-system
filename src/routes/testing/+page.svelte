<svelte:options runes={false} />

<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<svelte:head>
	<title>Manual Testing - Energy Tracking System</title>
</svelte:head>

<div class="testing-page-wrapper">
	<div class="container">
		<button class="back-btn" onclick={() => goto('/')}>
			<i class="fas fa-arrow-left"></i> Back to Dashboard
		</button>

		<div class="development-content">
			<i class="fas fa-tools icon-wip"></i>
			<h1>Still Under Development</h1>
			<p>
				The Manual Testing interface is currently being built. This module will eventually allow you
				to simulate hardware inputs and trigger alert thresholds manually.
			</p>
		</div>
	</div>
</div>

<style>
	/* Wrapper handles centering so layout controls the background theme smoothly */
	.testing-page-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 40px 20px;
		width: 100%;
		min-height: calc(100vh - 120px);
		box-sizing: border-box;
	}

	.container {
		width: 100%;
		max-width: 600px;
		padding: 50px 40px;
		background-color: var(--card-bg);
		border-radius: 16px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
		border: 1px solid var(--border);
		text-align: center;
		position: relative;
	}

	.back-btn {
		position: absolute;
		top: 20px;
		left: 20px;
		background: var(--input-bg);
		color: var(--text-main);
		border: 1px solid var(--border);
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.back-btn:hover {
		background: var(--border);
		transform: translateY(-1px);
	}

	.development-content {
		margin-top: 30px;
	}

	.icon-wip {
		font-size: 64px;
		color: var(--primary);
		margin-bottom: 25px;
		opacity: 0.8;
	}

	h1 {
		font-size: 28px;
		font-weight: 800;
		color: var(--text-main);
		margin-bottom: 15px;
		margin-top: 0;
	}

	p {
		color: var(--text-muted);
		font-size: 15px;
		line-height: 1.6;
		max-width: 450px;
		margin: 0 auto;
	}
</style>
