# Registra una tarea programada que arranca el servidor al iniciar sesion en Windows.
# Uso (PowerShell, sin necesidad de administrador):
#   .\install_autostart.ps1
# Para quitarla:
#   Unregister-ScheduledTask -TaskName 'KnowledgeMCP-GPUEmbedder' -Confirm:$false
$script = Join-Path $PSScriptRoot 'start_gpu_server.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName 'KnowledgeMCP-GPUEmbedder' `
  -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Servidor de embeddings OpenVINO (GPU) para Knowledge MCP' -Force