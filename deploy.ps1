# Google Cloud Deployment Script for Refinery Visual AI

Write-Host "Checking for Google Cloud CLI..."
if (!(Get-Command "gcloud" -ErrorAction SilentlyContinue)) {
    Write-Error "Google Cloud CLI (gcloud) is not installed or not in your PATH."
    Write-Host "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
}

# Check login status
$authStatus = gcloud auth list --format="value(account)" 2>$null
if (-not $authStatus) {
    Write-Host "You are not logged in. Opening login window..."
    gcloud auth login
}

# Get Project ID
$currentProject = gcloud config get-value project 2>$null
if ([string]::IsNullOrWhiteSpace($currentProject) -or $currentProject -eq "(unset)") {
    $projectId = Read-Host "Enter your Google Cloud Project ID"
    gcloud config set project $projectId
}
else {
    $useCurrent = Read-Host "Use current project '$currentProject'? (Y/n)"
    if ($useCurrent -eq "n") {
        $projectId = Read-Host "Enter your Google Cloud Project ID"
        gcloud config set project $projectId
    }
    else {
        $projectId = $currentProject
    }
}

# Enable necessary services
Write-Host "Enabling Cloud Build, Cloud Run, and Artifact Registry APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com

# Build and Push Container
Write-Host "Building container image..."
$imageName = "gcr.io/$projectId/refinery-eye"
gcloud builds submit --tag $imageName

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed."
    exit 1
}

# Deploy to Cloud Run
Write-Host "Deploying to Cloud Run..."
$serviceName = "refinery-eye"
$region = "us-central1" # You can change this

# Prompt for secrets
$geminiKey = Read-Host "Enter your GEMINI_API_KEY (leave blank if already set in env)"
$bucketName = Read-Host "Enter your BUCKET_NAME (default: refinery-eye-uploads)"
if (-not $bucketName) { $bucketName = "refinery-eye-uploads" }
$sessionSecret = Read-Host "Enter a SESSION_SECRET (random string)"
if (-not $sessionSecret) { $sessionSecret = [Guid]::NewGuid().ToString() }

$envVars = "BUCKET_NAME=$bucketName,SESSION_SECRET=$sessionSecret"
if ($geminiKey) {
    $envVars += ",GEMINI_API_KEY=$geminiKey"
}

gcloud run deploy $serviceName `
    --image $imageName `
    --platform managed `
    --region $region `
    --allow-unauthenticated `
    --set-env-vars $envVars

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful!"
    $serviceUrl = gcloud run services describe $serviceName --platform managed --region $region --format "value(status.url)"
    Write-Host "Your app is live at: $serviceUrl"
}
else {
    Write-Error "Deployment failed."
}
