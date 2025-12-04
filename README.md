# Refinery Eye AI - Local Setup

## Overview
This application runs completely locally with no cloud dependencies except for the Gemini AI API for video analysis.

## Architecture
- **Frontend**: React + Vite (served from `/dist`)
- **Backend**: Express.js server
- **File Storage**: Local file system (`/uploads` directory)
- **Database**: Local JSON file (`/data/reports.json`)
- **AI Analysis**: Google Gemini API (requires API key)

## Prerequisites
- Node.js 18 or higher
- Google Gemini API key

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   - Copy `.env.example` to `.env`
   - Add your Gemini API key to `.env`:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

3. **Build the frontend**:
   ```bash
   npm run build
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Access the application**:
   - Open your browser to `http://localhost:8080`
   - Login with:
     - Username: `JRinst`
     - Password: `JRiocl@2025`

## Directory Structure
```
├── uploads/          # Uploaded videos and PDFs (local storage)
├── data/            # Local database
│   └── reports.json # Saved analysis reports
├── dist/            # Built frontend files
├── server.js        # Express server
├── App.tsx          # Main React component
└── .env             # Environment variables
```

## Features
- ✅ Local file upload (videos and PDFs)
- ✅ AI-powered video analysis using Gemini
- ✅ Local report storage (JSON file)
- ✅ Session-based authentication
- ✅ PDF report generation

## How It Works

### Upload Flow
1. User uploads video → Saved to `/uploads` directory
2. User uploads reference PDFs → Saved to `/uploads` directory
3. Files served via `/api/content/*` endpoint

### Analysis Flow
1. Video file uploaded to Gemini API for processing
2. Reference PDFs sent as inline base64 data
3. Gemini analyzes video against references
4. Results returned and saved to local JSON database
5. Gemini file cleaned up after analysis

### Report Storage
- Reports saved to `data/reports.json`
- Each report has a unique UUID
- Reports include video URL, references, analysis results, and metadata

## No Cloud Dependencies
- ❌ No Google Cloud Storage
- ❌ No Firestore
- ❌ No Vercel
- ✅ Only Gemini API for AI analysis (temporary file upload during processing)

## Development

### Run in development mode:
```bash
npm run dev        # Frontend dev server
npm run dev:api    # API server (if separate)
```

### Build for production:
```bash
npm run build
npm start
```

## Troubleshooting

### "Analysis failed" error
- Check that `GEMINI_API_KEY` is set in `.env`
- Verify the API key is valid
- Check server logs for detailed error messages

### "Failed to upload video"
- Ensure `/uploads` directory exists (created automatically)
- Check file permissions
- Verify disk space

### Port already in use
```bash
# Find process using port 8080
netstat -ano | findstr :8080

# Kill the process (Windows)
taskkill /PID <PID> /F
```

## Security Notes
- Change default password in production
- Set a secure `SESSION_SECRET` in `.env`
- Keep `.env` file secure (never commit to git)
- Uploaded files are stored locally - ensure proper file system permissions

## Limitations
- Session storage uses MemoryStore (not suitable for production scaling)
- Reports stored in single JSON file (consider database for large scale)
- No file cleanup mechanism (uploaded files persist indefinitely)

## License
Proprietary - Refinery Eye AI
