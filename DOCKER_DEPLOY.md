# Docker Desktop Deployment Guide

## Step 1: Install Docker Desktop

1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Run the installer
3. **Restart your computer** (required for Docker to work)
4. Open Docker Desktop and wait for it to start (you'll see a whale icon in your system tray)

---

## Step 2: Verify Docker Installation

Open a new PowerShell window and run:
```powershell
docker --version
```

You should see something like: `Docker version 24.x.x`

---

## Step 3: Restore the Full-Stack Dockerfile

We need to use the full-stack Dockerfile (currently we have a simple nginx one).

Run this command:
```powershell
Copy-Item Dockerfile.backup Dockerfile -Force
```

---

## Step 4: Build the Docker Image Locally

```powershell
cd "C:\Users\KKR\Desktop\Refinery Visual AI"
docker build -t refinery-eye .
```

This will take a few minutes. You'll see the build progress.

---

## Step 5: Configure Docker for Google Cloud

```powershell
gcloud auth configure-docker us-central1-docker.pkg.dev
```

When prompted, type `y` and press Enter.

---

## Step 6: Tag the Image for Google Cloud

```powershell
docker tag refinery-eye us-central1-docker.pkg.dev/project-136d5868-ac0a-4ba8-85a/refinery-repo/refinery-eye:latest
```

---

## Step 7: Push to Google Artifact Registry

```powershell
docker push us-central1-docker.pkg.dev/project-136d5868-ac0a-4ba8-85a/refinery-repo/refinery-eye:latest
```

This uploads your container to Google Cloud. May take 5-10 minutes.

---

## Step 8: Deploy to Cloud Run

```powershell
gcloud run deploy refinery-eye `
  --image us-central1-docker.pkg.dev/project-136d5868-ac0a-4ba8-85a/refinery-repo/refinery-eye:latest `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars "GEMINI_API_KEY=YOUR_GEMINI_KEY,BUCKET_NAME=refinery-eye-uploads-project-136d5868-ac0a-4ba8-85a,SESSION_SECRET=YOUR_RANDOM_SECRET"
```

**Replace**:
- `YOUR_GEMINI_KEY` with your actual Gemini API key
- `YOUR_RANDOM_SECRET` with a random string (e.g., `my-secret-key-12345`)

---

## Step 9: Access Your App

After deployment completes, you'll see a URL like:
```
https://refinery-eye-xxxxx-uc.a.run.app
```

Open that URL in your browser!

---

## Troubleshooting

### Docker Desktop won't start
- Make sure Hyper-V is enabled (Windows feature)
- Restart computer again
- Check Docker Desktop logs

### Build fails
- Make sure you're in the correct directory
- Check that `Dockerfile.backup` exists
- Try `docker system prune` to clean up

### Push fails
- Verify you're logged into gcloud: `gcloud auth list`
- Check internet connection
- Verify Artifact Registry repository exists

---

## Quick Reference Commands

```powershell
# Check Docker status
docker --version

# View local images
docker images

# View running containers
docker ps

# Clean up old images
docker system prune -a
```

---

## Next Steps After Deployment

1. Test the login (username: `JRinst`, password: `JRiocl@2025`)
2. Upload a test video
3. Add reference documents
4. Run analysis

The app will use:
- Google Cloud Storage for file uploads
- Google Firestore for saving reports
- Gemini API for video analysis

---

**Ready to start? Install Docker Desktop and let me know when it's ready!**
