$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Test-Path '.venv\Scripts\python.exe')) { throw 'Create the Python 3.11/3.12 virtual environment and install requirements first. See README.md.' }
if (!(Test-Path 'frontend\dist\index.html')) { throw 'Build the frontend first: cd frontend; npm.cmd ci; npm.cmd run build. See README.md.' }
& '.\.venv\Scripts\python.exe' -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
