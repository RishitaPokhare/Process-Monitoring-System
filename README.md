# Process Monitoring System — React + FastAPI

A Windows-friendly Operating Systems mini-project with a live web dashboard.

## Features
- Live CPU and RAM overview cards
- CPU and RAM history charts
- Process table with search and sorting
- Process detail panel
- High-resource usage indicators
- Terminate selected process with confirmation
- System information and refresh controls
- React frontend + FastAPI backend using `psutil`

## Requirements
- Python 3.10+
- Node.js 18+ and npm
- Windows is the primary target; `psutil` also supports other operating systems.

## Project structure
```
process-monitoring-dashboard/
├── backend/
│   ├── main.py
│   └── requirements.txt
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── App.js
        ├── api.js
        └── styles.css
```

## 1. Start the backend
Open a terminal in the project folder:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload
```

If PowerShell blocks activation, use this instead:
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`.
API documentation: `http://127.0.0.1:8000/docs`.

## 2. Start the frontend
Open a **second terminal** from the project folder:

```powershell
cd frontend
npm install
npm start
```

The browser should open at `http://localhost:3000`.

## Important notes
- Keep both terminals running while using the dashboard.
- CPU percentage is sampled by `psutil`; the first sample may be close to zero while measurements initialize.
- Memory and CPU values are live estimates and can differ slightly from Windows Task Manager.
- Terminating a process may fail if Windows permissions do not allow it. Do not terminate system processes; unsaved work can be lost.
- This is a local educational project, not a production security or administration tool.
