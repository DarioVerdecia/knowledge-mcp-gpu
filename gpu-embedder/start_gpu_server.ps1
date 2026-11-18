# Arranca el servidor de embeddings en segundo plano (sin ventana).
# Se ejecuta desde cualquier carpeta: usa la ubicacion de este script.
$dir = $PSScriptRoot
$logs = Join-Path $dir 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

Start-Process -FilePath (Join-Path $dir '.venv\Scripts\python.exe') `
  -ArgumentList 'gpu_server.py' `
  -WorkingDirectory $dir `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logs 'gpu_server_stdout.log') `
  -RedirectStandardError  (Join-Path $logs 'gpu_server_stderr.log')