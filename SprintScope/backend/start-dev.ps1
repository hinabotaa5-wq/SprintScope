Set-Location $PSScriptRoot

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Error "Go is not installed. Install from https://go.dev/dl/"
    exit 1
}

if (-not (Test-Path ".env")) {
    Write-Host "Copy env.example to .env and fill in your keys:"
    Write-Host "  Copy-Item env.example .env"
}

Write-Host "Starting Go API at http://localhost:8080"
go run .
