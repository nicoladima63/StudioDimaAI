Scan the repository and identify:

- existing data extraction scripts
- database connectors
- analytics code already present
- data schemas

Then adapt the skill to reuse existing components.

You are an expert AI systems architect helping me build a Claude Skill that integrates with my existing project.

PROJECT CONTEXT
This repository contains a Python backend and a React dashboard used to analyze operational data from a dental practice.
The system extracts structured data from a practice management system (appointments, treatments, durations, providers, etc.).

GOAL
Create a Claude Skill called **studio-analytics** that orchestrates Python scripts to analyze practice data and generate insights and dashboard-ready outputs.

The skill should act as a workflow orchestrator:

User request
→ read agenda / operational data
→ compute productivity metrics
→ detect inefficiencies
→ forecast revenue
→ export structured results for the React dashboard

FIRST TASK

Scan the entire repository and identify:

* existing data extraction scripts
* database connectors
* analytics code already present
* data schemas or models
* scripts already interacting with the agenda or appointments

Reuse existing components when possible instead of recreating them.

WORKFLOW TO IMPLEMENT

1. Fetch operational data

Use existing code if available.
If no suitable script exists, create:

scripts/read_agenda.py

Expected output:

A normalized dataset (JSON or CSV) including at least:

* patient_id
* procedure
* duration
* provider
* date
* revenue

2. Compute KPIs

Create or reuse:

scripts/compute_kpi.py

Metrics should include:

* production per hour
* chair utilization
* provider productivity
* treatment mix
* no-show rate (if data available)

3. Detect inefficiencies

Create:

scripts/detect_inefficiencies.py

Detect patterns such as:

* unused chair time
* appointment fragmentation
* low productivity procedures occupying prime slots

4. Forecast revenue

Create:

scripts/forecast.py

Implement a simple forecasting model using historical data.

Acceptable implementations:

* moving average
* linear regression
* simple time-series model

Output:

projected monthly revenue.

5. Export dashboard data

Create:

scripts/export_dashboard_json.py

Output a JSON file structured for a React dashboard containing:

* KPI summary
* productivity metrics
* revenue forecast
* detected inefficiencies

SKILL STRUCTURE

Create this structure if it does not exist:

studio-analytics/
│
├── SKILL.md
│
├── scripts/
│   ├── read_agenda.py
│   ├── compute_kpi.py
│   ├── detect_inefficiencies.py
│   ├── forecast.py
│   └── export_dashboard_json.py
│
└── references/
└── metrics-definition.md

SKILL.MD REQUIREMENTS

Include a valid YAML frontmatter:

---

name: studio-analytics
description: Analyze dental practice operational data, compute productivity metrics, detect inefficiencies, forecast revenue, and generate dashboard-ready analytics. Use when the user asks for practice analytics, productivity analysis, or financial forecasting.

Then define the workflow steps that execute the scripts sequentially.

SCRIPT REQUIREMENTS

For each Python script:

* make it runnable from CLI
* keep the implementation simple and readable
* return structured JSON where possible
* include basic error handling
* keep scripts modular

Preferred libraries:

* pandas
* numpy
* scikit-learn (optional)

Avoid unnecessary complexity.

OUTPUT FORMAT

When finished:

1. Show the full folder structure created.
2. Show the contents of SKILL.md.
3. Show the generated Python scripts.
4. Briefly explain how the skill workflow operates.

If files already exist in the repository, reuse them instead of recreating them.
If something is missing, create the minimal working implementation.





python studio-analytics/scripts/forecast.py --anno 2025
python studio-analytics/scripts/read_agenda.py --anno 2025 --mese 1
python studio-analytics/scripts/compute_kpi.py --anno 2025 --section current
python studio-analytics/scripts/detect_inefficiencies.py --anno 2025
python studio-analytics/scripts/export_dashboard_json.py --anno 2025