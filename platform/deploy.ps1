#!/usr/bin/env pwsh
# Admin Panel Deployment Script

Write-Host "🚀 Starting Admin Panel Deployment..." -ForegroundColor Green

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the platform directory." -ForegroundColor Red
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: Failed to install dependencies." -ForegroundColor Red
        exit 1
    }
}

# Clean previous build
Write-Host "🧹 Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

# Build the project
Write-Host "🔨 Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Build failed." -ForegroundColor Red
    exit 1
}

# Verify build output
if (!(Test-Path "dist/index.html")) {
    Write-Host "❌ Error: Build output not found." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully!" -ForegroundColor Green

# Show build stats
Write-Host "`n📊 Build Statistics:" -ForegroundColor Cyan
Get-ChildItem -Path "dist" -Recurse | ForEach-Object {
    if ($_.PSIsContainer -eq $false) {
        $size = [math]::Round($_.Length / 1KB, 2)
        Write-Host "  $($_.Name): ${size} KB" -ForegroundColor Gray
    }
}

Write-Host "`n🎯 Deployment Instructions:" -ForegroundColor Cyan
Write-Host "1. Upload the contents of the 'dist' folder to your web server" -ForegroundColor White
Write-Host "2. Ensure the server serves index.html for all routes (SPA routing)" -ForegroundColor White
Write-Host "3. Configure CORS headers if needed" -ForegroundColor White
Write-Host "4. Test the deployment at: https://app.ragleaf.com/" -ForegroundColor White

Write-Host "`n✨ Deployment preparation complete!" -ForegroundColor Green
