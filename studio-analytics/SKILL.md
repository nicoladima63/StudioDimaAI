---
name: studio-analytics
description: Analyze dental practice economics, detect scheduling inefficiencies, compute KPIs, and generate forecasts. Use when the user asks about studio performance, revenue analysis, appointment utilization, cost analysis, or financial forecasting.
---

# Studio Analytics - Dental Practice Analysis Toolkit

Analyze the dental practice economics using data from WinDent DBF files.
All scripts output structured JSON and reuse the existing server_v2 economics engines.

## Prerequisites

Scripts must be run from the project root directory. The server_v2 Python environment
must be available (pandas, numpy, dbf libraries installed).

## Available Scripts

### 1. Read Agenda
Extract appointment data enriched with patient info and revenue estimates.

```bash
python studio-analytics/scripts/read_agenda.py --anno YYYY [--mese MM] [--medico ID] [--output PATH]
```

Arguments:
- `--anno YYYY` (required): Year to analyze
- `--mese MM` (optional): Filter to a specific month (1-12)
- `--medico ID` (optional): Filter by doctor ID
- `--output PATH` (optional): Write JSON to file instead of stdout

### 2. Compute KPIs
Calculate key performance indicators: production, margins, chair utilization, treatment mix.

```bash
python studio-analytics/scripts/compute_kpi.py --anno YYYY [--section SECTION] [--output PATH]
```

Arguments:
- `--anno YYYY` (required): Year to analyze
- `--section all|current|monthly|category|operator` (optional, default: all)
- `--output PATH` (optional): Write JSON to file

### 3. Detect Inefficiencies
Find scheduling gaps, fragmentation, low-revenue prime slots, and potential no-shows.

```bash
python studio-analytics/scripts/detect_inefficiencies.py --anno YYYY [--mese MM] [--soglia-gap N] [--output PATH]
```

Arguments:
- `--anno YYYY` (required): Year to analyze
- `--mese MM` (optional): Filter to a specific month
- `--soglia-gap N` (optional): Minimum gap in minutes to flag (default: 30)
- `--output PATH` (optional): Write JSON to file

### 4. Forecast
Generate end-of-year projections with three scenarios (conservative, realistic, optimistic).

```bash
python studio-analytics/scripts/forecast.py --anno YYYY [--output PATH]
```

Arguments:
- `--anno YYYY` (required): Year to forecast
- `--output PATH` (optional): Write JSON to file

### 5. Export Dashboard JSON
Aggregate all analytics into a single dashboard-ready JSON file.

```bash
python studio-analytics/scripts/export_dashboard_json.py --anno YYYY [--output PATH] [--skip-inefficiencies]
```

Arguments:
- `--anno YYYY` (required): Year to analyze
- `--output PATH` (optional, default: studio-analytics/output/dashboard_YYYY.json)
- `--skip-inefficiencies` (optional): Skip inefficiency analysis for faster export

## Workflow

1. Start with `read_agenda.py` to inspect raw appointment data
2. Run `compute_kpi.py` to get the current financial picture
3. Use `detect_inefficiencies.py` to find optimization opportunities
4. Run `forecast.py` to project end-of-year scenarios
5. Use `export_dashboard_json.py` to create a complete snapshot for the React dashboard

For detailed metric definitions, see [references/metrics-definition.md](references/metrics-definition.md).
