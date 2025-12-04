import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Initialize Gemini (only for AI analysis)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY not set. Analysis will fail.');
}
const fileManager = apiKey ? new GoogleAIFileManager(apiKey) : null;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

console.log('Server initialized for fully local execution');
console.log('Gemini API:', apiKey ? 'Configured' : 'NOT configured');

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
const reportsFile = path.join(dataDir, 'reports.json');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(reportsFile)) {
  fs.writeFileSync(reportsFile, JSON.stringify([]));
}

// Helper functions for local JSON database
const readReports = () => {
  try {
    const data = fs.readFileSync(reportsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading reports:', error);
    return [];
  }
};

const writeReports = (reports) => {
  try {
    fs.writeFileSync(reportsFile, JSON.stringify(reports, null, 2));
  } catch (error) {
    console.error('Error writing reports:', error);
  }
};

// Multer for file uploads (Disk Storage)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'refinery-eye-secret-local',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Serve uploaded content locally
app.use('/api/content', express.static(uploadsDir));

// Authentication credentials (hashed password)
const VALID_USERNAME = 'JRinst';
const VALID_PASSWORD_HASH = bcrypt.hashSync('JRiocl@2025', 10);

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// API Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === VALID_USERNAME && bcrypt.compareSync(password, VALID_PASSWORD_HASH)) {
    req.session.authenticated = true;
    req.session.username = username;
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session?.authenticated });
});

// Upload video (Local Storage)
app.post('/api/upload-video', requireAuth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    console.log('Video uploaded locally:', req.file.path);

    // Return local URL
    const url = `/api/content/${req.file.filename}`;

    res.json({
      success: true,
      url,
      filename: req.file.originalname,
      storagePath: req.file.filename
    });
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Upload reference PDFs (Local Storage)
app.post('/api/upload-references', requireAuth, upload.array('references', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.json({ success: true, files: [] });
    }

    const files = req.files.map(file => ({
      url: `/api/content/${file.filename}`,
      filename: file.originalname,
      storagePath: file.filename
    }));

    res.json({ success: true, files });
  } catch (error) {
    console.error('Upload references error:', error);
    res.status(500).json({ error: 'Failed to upload reference files' });
  }
});

// Analyze video with Gemini (using File API)
app.post('/api/analyze', requireAuth, async (req, res) => {
  try {
    console.log('=== Analysis Request Started ===');
    const { videoUrl, referenceUrls = [] } = req.body;
    console.log('Video URL:', videoUrl);
    console.log('Reference URLs:', referenceUrls);

    if (!videoUrl) {
      console.error('ERROR: No video URL provided');
      return res.status(400).json({ error: 'Video URL required' });
    }

    if (!apiKey || !fileManager || !genAI) {
      console.error('ERROR: Gemini API not configured');
      console.error('API Key exists:', !!apiKey);
      console.error('FileManager exists:', !!fileManager);
      console.error('GenAI exists:', !!genAI);
      return res.status(500).json({ error: 'Gemini API not configured. Please set GEMINI_API_KEY in .env file.' });
    }

    // Extract filename from URL
    const videoFilename = videoUrl.split('/').pop();
    const videoPath = path.join(uploadsDir, videoFilename);
    console.log('Video filename:', videoFilename);
    console.log('Video path:', videoPath);

    if (!fs.existsSync(videoPath)) {
      console.error('ERROR: Video file not found at:', videoPath);
      return res.status(404).json({ error: 'Video file not found on server' });
    }

    const stats = fs.statSync(videoPath);
    console.log('Video file size:', stats.size, 'bytes');

    console.log('Uploading video to Gemini...');

    // Upload video to Gemini
    const uploadResponse = await fileManager.uploadFile(videoPath, {
      mimeType: "video/mp4",
      displayName: videoFilename,
    });

    console.log(`✓ Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`);

    // Wait for processing to complete
    let file = await fileManager.getFile(uploadResponse.file.name);
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    while (file.state === "PROCESSING") {
      attempts++;
      console.log(`Processing video... (attempt ${attempts}/${maxAttempts})`);

      if (attempts >= maxAttempts) {
        throw new Error("Video processing timeout - took longer than 2 minutes");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      file = await fileManager.getFile(uploadResponse.file.name);
    }

    if (file.state === "FAILED") {
      console.error('ERROR: Video processing failed');
      throw new Error("Video processing failed.");
    }

    console.log("✓ Video processing complete. State:", file.state);

    // Prepare reference PDFs
    console.log('Processing reference PDFs...');
    const pdfParts = await Promise.all(
      referenceUrls.map(async (url, index) => {
        if (url.startsWith('/api/content/')) {
          const filename = url.split('/').pop();
          const filePath = path.join(uploadsDir, filename);
          console.log(`  PDF ${index + 1}: ${filename}`);

          if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            console.log(`  ✓ Loaded PDF ${index + 1}, size: ${buffer.length} bytes`);
            return {
              inlineData: {
                mimeType: 'application/pdf',
                data: buffer.toString('base64')
              }
            };
          } else {
            console.warn(`  ✗ PDF not found: ${filePath}`);
          }
        }
        return null;
      })
    );

    const validPdfParts = pdfParts.filter(p => p !== null);
    console.log(`✓ Loaded ${validPdfParts.length} reference PDFs`);

    // Call Gemini API
    console.log('Calling Gemini API for analysis...');
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING" },
            faults: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  timestamp: { type: "STRING" },
                  component: { type: "STRING" },
                  tagNumber: { type: "STRING" },
                  faultType: { type: "STRING" },
                  description: { type: "STRING" },
                  severity: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"] },
                  standardGap: { type: "STRING" },
                  recommendation: { type: "STRING" }
                },
                required: ["timestamp", "component", "tagNumber", "faultType", "description", "severity", "standardGap", "recommendation"]
              }
            }
          },
          required: ["summary", "faults"]
        }
      }
    });

    const prompt = `
      You are a Senior Reliability Engineer at a refinery.
      Analyze the video to identify visual faults and equipment tag numbers.
      Look for tag numbers in formats like: 20-FV-2300, JBS-203, TE-2312, etc.
      If no tag visible, use "Near [location text]" based on nearby signage.
      Compare against provided reference documents and identify standard violations.
    `;

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResponse.file.mimeType,
          fileUri: uploadResponse.file.uri
        }
      },
      ...validPdfParts,
      { text: prompt }
    ]);

    console.log('✓ Gemini API call successful');

    const text = result.response.text();
    console.log('Response text length:', text.length);

    const analysisResult = JSON.parse(text);
    console.log('✓ Parsed analysis result. Faults found:', analysisResult.faults?.length || 0);

    // Clean up Gemini file
    try {
      await fileManager.deleteFile(uploadResponse.file.name);
      console.log('✓ Cleaned up Gemini file');
    } catch (e) {
      console.warn('Could not delete Gemini file:', e.message);
    }

    console.log('=== Analysis Complete ===');
    res.json({ success: true, result: analysisResult });

  } catch (error) {
    console.error('=== Analysis Error ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Send detailed error to client
    res.status(500).json({
      error: 'Analysis failed: ' + error.message,
      details: error.stack
    });
  }
});

// Save report to local JSON file
app.post('/api/save-report', requireAuth, async (req, res) => {
  try {
    const { videoUrl, videoFileName, referenceUrls, referenceFileNames, result } = req.body;

    const reports = readReports();

    const newReport = {
      id: uuidv4(),
      videoUrl,
      videoFileName,
      referenceUrls: referenceUrls || [],
      referenceFileNames: referenceFileNames || [],
      summary: result.summary,
      faults: result.faults,
      createdAt: new Date().toISOString(),
      createdBy: req.session.username
    };

    reports.push(newReport);
    writeReports(reports);

    res.json({ success: true, reportId: newReport.id });
  } catch (error) {
    console.error('Save report error:', error);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

// Get all reports
app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const reports = readReports();

    // Sort by createdAt descending and limit to 50
    const sortedReports = reports
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);

    res.json({ success: true, reports: sortedReports });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get specific report
app.get('/api/reports/:id', requireAuth, async (req, res) => {
  try {
    const reports = readReports();
    const report = reports.find(r => r.id === req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Delete report
app.delete('/api/reports/:id', requireAuth, async (req, res) => {
  try {
    const reports = readReports();
    const filteredReports = reports.filter(r => r.id !== req.params.id);

    if (reports.length === filteredReports.length) {
      return res.status(404).json({ error: 'Report not found' });
    }

    writeReports(filteredReports);
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Upload directory: ${uploadsDir}`);
  console.log(`Reports database: ${reportsFile}`);
});