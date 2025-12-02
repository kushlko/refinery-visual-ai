# Vercel Deployment Configuration

This is an alternative deployment option that's much simpler than Google Cloud.

## Quick Deploy to Vercel

1. **Install Vercel CLI**:
   ```powershell
   npm install -g vercel
   ```

2. **Deploy**:
   ```powershell
   vercel
   ```

3. **Follow the prompts**:
   - Link to your Vercel account (it will open a browser)
   - Accept the default project settings
   - Deploy!

## Configuration

The `vercel.json` file is already configured for this project.

## Environment Variables

After deployment, add these in the Vercel dashboard:
- `GEMINI_API_KEY`: Your Gemini API key

## Notes

- Vercel is free for personal projects
- Automatic HTTPS
- Global CDN
- Much simpler than Google Cloud
- Perfect for React frontends

The backend features (authentication, Cloud Storage) won't work on Vercel since it's frontend-only, but you'll have a working deployment to test the UI.
