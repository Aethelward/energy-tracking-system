<svelte:options runes={false} />

<script lang="ts">
	import { dbApi, groundDb, secondDb } from '$lib/firebase';
	import jsPDF from 'jspdf';
	import autoTable from 'jspdf-autotable';

	type Timeframe = 'day' | 'month' | 'year';
	type Floor = 'ground' | 'second';

	type Summary = {
		totalWattage: number;
		avgVoltage: number;
		avgCurrent: number;
	};

	let currentFloor: Floor = 'ground';
	let currentTimeframe: Timeframe = 'day';
	let rows: Array<{ label: string; watt: number; avgVolt: number; avgCurr: number }> = [];
	let summary: Summary = { totalWattage: 0, avgVoltage: 0, avgCurrent: 0 };
	let loading = false;
	let error = '';

	function parseTimestamp(ts: string): Date {
		const y = parseInt(ts.substring(0, 4));
		const m = parseInt(ts.substring(4, 6)) - 1;
		const d = parseInt(ts.substring(6, 8));
		const h = ts.length > 8 ? parseInt(ts.substring(8, 10)) : 0;
		const min = ts.length > 10 ? parseInt(ts.substring(10, 12)) : 0;
		const s = ts.length > 12 ? parseInt(ts.substring(12, 14)) : 0;
		return new Date(y, m, d, h, min, s);
	}

	function setFloor(floor: Floor) {
		currentFloor = floor;
		void loadData();
	}

	function setTimeframe(frame: Timeframe) {
		currentTimeframe = frame;
		void loadData();
	}

	function groupData(data: Record<string, { power?: number; voltage?: number; current?: number }>) {
		const grouped: Record<
			string,
			{ watt: number; voltSum: number; currSum: number; count: number; dt: Date }
		> = {};
		for (const key in data) {
			const entry = data[key];
			const dt = parseTimestamp(key);
			const year = dt.getFullYear();
			const month = dt.getMonth();
			const day = dt.getDate();

			let groupKey = '';
			if (currentTimeframe === 'day') groupKey = `${year}-${month}-${day}`;
			if (currentTimeframe === 'month') groupKey = `${year}-${month}`;
			if (currentTimeframe === 'year') groupKey = `${year}`;

			if (!grouped[groupKey]) {
				grouped[groupKey] = { watt: 0, voltSum: 0, currSum: 0, count: 0, dt };
			}

			const p = Number(entry.power ?? (entry.voltage ?? 0) * (entry.current ?? 0));
			const v = Number(entry.voltage ?? 0);
			const c = Number(entry.current ?? 0);
			grouped[groupKey].watt += p;
			grouped[groupKey].voltSum += v;
			grouped[groupKey].currSum += c;
			grouped[groupKey].count += 1;
		}

		const sorted = Object.keys(grouped).sort();
		rows = sorted.map((k) => {
			const g = grouped[k];
			const label =
				currentTimeframe === 'day'
					? g.dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
					: currentTimeframe === 'month'
						? g.dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
						: `${g.dt.getFullYear()}`;
			return {
				label,
				watt: g.watt,
				avgVolt: g.count ? g.voltSum / g.count : 0,
				avgCurr: g.count ? g.currSum / g.count : 0
			};
		});

		const totalWattage = rows.reduce((acc, r) => acc + r.watt, 0);
		const totalVoltSum = Object.values(grouped).reduce((acc, g) => acc + g.voltSum, 0);
		const totalCurrSum = Object.values(grouped).reduce((acc, g) => acc + g.currSum, 0);
		const totalCount = Object.values(grouped).reduce((acc, g) => acc + g.count, 0);
		summary = {
			totalWattage,
			avgVoltage: totalCount ? totalVoltSum / totalCount : 0,
			avgCurrent: totalCount ? totalCurrSum / totalCount : 0
		};
	}

	async function loadData() {
		loading = true;
		error = '';
		rows = [];
		const db = currentFloor === 'ground' ? groundDb : secondDb;
		try {
			const snap = await dbApi.get(dbApi.ref(db, 'history'));
			if (!snap.exists()) {
				summary = { totalWattage: 0, avgVoltage: 0, avgCurrent: 0 };
				return;
			}
			groupData(snap.val());
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load data';
		} finally {
			loading = false;
		}
	}

	function downloadPDF() {
		if (rows.length === 0) {
			alert('No data to download!');
			return;
		}
		const doc = new jsPDF();
		const floorTitle = `${currentFloor.charAt(0).toUpperCase()}${currentFloor.slice(1)} Floor`;
		doc.setFontSize(18);
		doc.text(`${floorTitle} Energy Report`, 14, 20);
		autoTable(doc, {
			head: [['Time', 'Total Wattage (W)', 'Voltage (V)', 'Current (A)']],
			body: rows.map((row) => [
				row.label,
				row.watt.toFixed(2),
				row.avgVolt.toFixed(2),
				row.avgCurr.toFixed(2)
			]),
			startY: 30
		});
		doc.save(`${floorTitle}_Report.pdf`);
	}

	void loadData();
</script>

<svelte:head>
	<title>Consumption Report - Energy Tracking System</title>
</svelte:head>

<button class="back-btn" onclick={() => window.location.assign('/')}>
	<i class="fas fa-arrow-left"></i> Back
</button>

<h1>Consumption Report</h1>

<div class="floor-selector">
	<button
		class:active={currentFloor === 'ground'}
		class="floor-tab"
		onclick={() => setFloor('ground')}>Ground Floor</button
	>
	<button
		class:active={currentFloor === 'second'}
		class="floor-tab"
		onclick={() => setFloor('second')}>Second Floor</button
	>
</div>

<div class="controls">
	<button class:active-time={currentTimeframe === 'day'} onclick={() => setTimeframe('day')}
		><i class="fas fa-calendar-day"></i> Day</button
	>
	<button class:active-time={currentTimeframe === 'month'} onclick={() => setTimeframe('month')}
		><i class="fas fa-calendar-alt"></i> Month</button
	>
	<button class:active-time={currentTimeframe === 'year'} onclick={() => setTimeframe('year')}
		><i class="fas fa-calendar"></i> Year</button
	>
	<button onclick={downloadPDF}><i class="fas fa-file-pdf"></i> Download PDF</button>
</div>

<div class="summary">
	<div>Total Wattage: {summary.totalWattage.toFixed(2)} W</div>
	<div>Average Voltage: {summary.avgVoltage.toFixed(2)} V</div>
	<div>Average Current: {summary.avgCurrent.toFixed(2)} A</div>
</div>

<table>
	<thead>
		<tr>
			<th>Time</th>
			<th>Total Wattage (W)</th>
			<th>Average Voltage (V)</th>
			<th>Average Current (A)</th>
		</tr>
	</thead>
	<tbody>
		{#if loading}
			<tr><td colspan="4">Loading data...</td></tr>
		{:else if error}
			<tr><td colspan="4" style="color:red;">{error}</td></tr>
		{:else if rows.length === 0}
			<tr><td colspan="4">No data found for this floor.</td></tr>
		{:else}
			{#each rows as row (row.label)}
				<tr>
					<td>{row.label}</td>
					<td>{row.watt.toFixed(2)}</td>
					<td>{row.avgVolt.toFixed(2)}</td>
					<td>{row.avgCurr.toFixed(2)}</td>
				</tr>
			{/each}
		{/if}
	</tbody>
</table>

<style>
	:global(body) {
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background-color: #f4f6f8;
		margin: 0;
		padding: 20px;
		color: #1a1a1a;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.back-btn {
		position: absolute;
		top: 20px;
		left: 20px;
		padding: 10px 15px;
		font-size: 14px;
		border: none;
		border-radius: 6px;
		background-color: #555;
		color: white;
		cursor: pointer;
	}
	h1 {
		color: #2e8b57;
		margin: 40px 0 20px;
		font-size: 32px;
		text-transform: uppercase;
		font-weight: 800;
	}
	.floor-selector {
		display: flex;
		background: #e0e0e0;
		padding: 5px;
		border-radius: 10px;
		margin-bottom: 30px;
		gap: 10px;
	}
	.floor-tab {
		padding: 12px 30px;
		font-size: 16px;
		font-weight: bold;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		background: transparent;
		color: #555;
	}
	.floor-tab.active {
		background-color: #2e8b57;
		color: white;
	}
	.controls {
		display: flex;
		gap: 15px;
		margin-bottom: 25px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.controls button {
		padding: 12px 20px;
		font-size: 16px;
		border-radius: 8px;
		border: 1px solid #2e8b57;
		background-color: white;
		color: #2e8b57;
		cursor: pointer;
		font-weight: 600;
	}
	.controls button.active-time {
		background-color: #2e8b57;
		color: white;
	}
	.summary {
		width: 90%;
		max-width: 900px;
		background-color: #e8f5e9;
		border-left: 5px solid #2e8b57;
		border-radius: 6px;
		padding: 20px;
		margin-bottom: 25px;
		display: flex;
		justify-content: space-around;
		font-size: 16px;
		font-weight: bold;
		color: #1a472f;
	}
	table {
		width: 90%;
		max-width: 900px;
		border-collapse: separate;
		border-spacing: 0;
		margin-bottom: 30px;
		border-radius: 8px;
		overflow: hidden;
		background: white;
	}
	th,
	td {
		padding: 15px;
		text-align: center;
		border-bottom: 1px solid #eee;
	}
	th {
		background-color: #2e8b57;
		color: white;
		font-size: 16px;
	}
</style>
