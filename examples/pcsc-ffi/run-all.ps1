# PowerShell script to run all PC/SC FFI demos

# Move to the directory of this script
Set-Location $PSScriptRoot

# Function to check if PC/SC service is running and start it if not
function Check-PCSCService {
    Write-Host "Checking if PC/SC service is running..."
    
    try {
        $service = Get-Service -Name "SCardSvr" -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq "Running") {
            Write-Host "PC/SC service is already running."
            return $true
        } else {
            Write-Host "PC/SC service is not running. Starting it..."
            Start-Service -Name "SCardSvr" -ErrorAction Stop
            Write-Host "PC/SC service started successfully."
            return $true
        }
    } catch {
        Write-Host "Failed to start PC/SC service. Please check if it's installed."
        Write-Host "You may need to install PC/SC drivers for your smart card reader."
        Write-Host "For Windows, PC/SC services are usually included with the OS."
        return $false
    }
}

# Build the demo
Write-Host "Building the demo project..."
npm run build

# Check build status
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Aborting."
    exit 1
}

# Check PC/SC service
if (-not (Check-PCSCService)) {
    Write-Host "PC/SC service check failed. Aborting."
    exit 1
}

# Create a directory for logs
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# Run the demo scripts and save their output
Write-Host "Running demo scripts..."

Write-Host "Running list_readers.js..."
& node dist/src/list_readers.js | Tee-Object -FilePath "logs/list_readers.log"
Write-Host ""

Write-Host "Running card_status.js..."
& node dist/src/card_status.js | Tee-Object -FilePath "logs/card_status.log"
Write-Host ""

Write-Host "Running transaction.js..."
& node dist/src/transaction.js | Tee-Object -FilePath "logs/transaction.log"
Write-Host ""

Write-Host "Running send_apdu.js..."
& node dist/src/send_apdu.js | Tee-Object -FilePath "logs/send_apdu.log"
Write-Host ""

Write-Host "All demos completed. Logs saved to the 'logs' directory." 