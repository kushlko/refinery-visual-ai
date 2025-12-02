# Refinery Visual AI

An AI-powered video inspection analysis system for refinery instrumentation using Google Gemini AI.

## Features

- 🎥 **Video Upload & Analysis**: Upload inspection videos for automated fault detection
- 📄 **Reference Document Support**: Upload PDF standards (OISD, manuals) or provide URLs
- 🤖 **AI-Powered Analysis**: Uses Google Gemini 1.5 Pro for intelligent fault detection
- 📊 **Detailed Reports**: Generate comprehensive PDF reports with timestamps and recommendations
- 🏷️ **Tag Number Detection**: Automatically identifies equipment tag numbers in videos
- 🔐 **Secure Authentication**: Built-in login system with session management
- ☁️ **Cloud Storage**: Google Cloud Storage integration for video and document handling
- 💾 **Report History**: Firestore database for storing and retrieving past reports

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **jsPDF** for PDF generation

### Backend
- **Node.js** with Express
- **Google Cloud Storage** for file storage
- **Google Cloud Firestore** for database
- **Google Gemini AI** for video analysis
- **Multer** for file uploads
- **bcryptjs** for password hashing

## Prerequisites

- Node.js 18 or higher
- Google Cloud Platform account
- Google Cloud Storage bucket
- Gemini API key
- Git

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/refinery-visual-ai.git
   cd refinery-visual-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   BUCKET_NAME=your_gcs_bucket_name
   SESSION_SECRET=your_random_session_secret
   ```

4. **Configure Google Cloud**
   - Enable Cloud Storage API
   - Enable Firestore API
   - Create a storage bucket
   - Set up authentication (service account or gcloud auth)

## Development

Run the development server:

```bash
# Frontend (Vite dev server)
npm run dev

# Backend API (separate terminal)
npm run dev:api
```

The app will be available at `http://localhost:3000`

## Production Build

```bash
npm run build
npm start
```

## Deployment

### Google Cloud Run

1. **Build and deploy using the provided script**
   ```powershell
   .\deploy.ps1
   ```

2. **Or manually**
   ```bash
   # Build container
   gcloud builds submit --tag gcr.io/PROJECT_ID/refinery-eye
   
   # Deploy to Cloud Run
   gcloud run deploy refinery-eye \
     --image gcr.io/PROJECT_ID/refinery-eye \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars BUCKET_NAME=your-bucket,GEMINI_API_KEY=your-key
   ```

### Docker

```bash
docker build -t refinery-eye .
docker run -p 8080:8080 \
  -e GEMINI_API_KEY=your_key \
  -e BUCKET_NAME=your_bucket \
  refinery-eye
```

## Usage

1. **Login** with credentials (default: `JRinst` / `JRiocl@2025`)
2. **Upload Video** - Select an inspection video (MP4, WebM, max 100MB)
3. **Add References** (optional):
   - Upload PDF documents (OISD standards, manuals)
   - Add web URLs to online standards
4. **Analyze** - Click "Analyze Findings" to start AI processing
5. **Review Results** - View detected faults with timestamps, severity, and recommendations
6. **Download Report** - Generate and download PDF report

## Project Structure

```
refinery-visual-ai/
├── components/          # React components
│   ├── Login.tsx
│   └── Button.tsx
├── services/           # API and service layers
│   ├── api.ts
│   └── geminiService.ts
├── utils/              # Utility functions
│   └── pdfGenerator.ts
├── App.tsx             # Main application component
├── server.js           # Express backend server
├── types.ts            # TypeScript type definitions
├── Dockerfile          # Docker configuration
├── deploy.ps1          # Deployment script
└── package.json        # Dependencies
```

## Security Notes

- Change default credentials in production
- Use strong SESSION_SECRET
- Keep `.env.local` out of version control
- Enable HTTPS in production
- Configure CORS appropriately

## Troubleshooting

### Video Upload Fails
- Check Cloud Storage bucket permissions
- Verify CORS configuration on bucket
- Ensure service account has `storage.objects.create` permission

### Analysis Fails
- Verify Gemini API key is valid
- Check video format (MP4, WebM supported)
- Ensure video size is under 100MB

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (18+ required)
- Clear `node_modules` and reinstall if needed

## License

MIT License - See LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.

## Acknowledgments

- Google Gemini AI for video analysis capabilities
- Google Cloud Platform for infrastructure
- React and Vite communities
