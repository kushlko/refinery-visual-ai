import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Initialize Google Cloud services
const storage = new Storage();
const firestore = new Firestore();
const bucketName = process.env.BUCKET_NAME || 'refinery-eye-uploads';
const bucket = storage.bucket(bucketName);

// Multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'refinery-eye-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

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

// Helper function to convert file to base64
const fileToBase64 = (buffer) => {
    return buffer.toString('base64');
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

// Upload video to Cloud Storage
app.post('/api/upload-video', requireAuth, upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const filename = `videos/${Date.now()}-${req.file.originalname}`;
        const file = bucket.file(filename);

        await file.save(req.file.buffer, {
            metadata: {
                contentType: req.file.mimetype
            }
        });

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            url,
            filename: req.file.originalname,
            storagePath: filename
        });
    } catch (error) {
        console.error('Upload video error:', error);
        res.status(500).json({ error: 'Failed to upload video' });
    }
});

// Upload reference PDFs to Cloud Storage
app.post('/api/upload-references', requireAuth, upload.array('references', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.json({ success: true, files: [] });
        }

        const uploadPromises = req.files.map(async (file) => {
            const filename = `references/${Date.now()}-${file.originalname}`;
            const storageFile = bucket.file(filename);

            await storageFile.save(file.buffer, {
                metadata: {
                    contentType: file.mimetype
                }
            });

            const [url] = await storageFile.getSignedUrl({
                action: 'read',
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000
            });

            return {
                url,
                filename: file.originalname,
                storagePath: filename
            };
        });

        const files = await Promise.all(uploadPromises);
        res.json({ success: true, files });
    } catch (error) {
        console.error('Upload references error:', error);
        res.status(500).json({ error: 'Failed to upload reference files' });
    }
});

// Analyze video with Gemini
app.post('/api/analyze', requireAuth, async (req, res) => {
    try {
        const { videoUrl, referenceUrls = [], referenceUrlsList = [] } = req.body;

        if (!videoUrl) {
            return res.status(400).json({ error: 'Video URL required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Gemini API key not configured' });
        }

        // Download files from Cloud Storage
        const videoFilename = videoUrl.split('/').pop().split('?')[0];
        const videoFile = bucket.file(videoFilename);
        const [videoBuffer] = await videoFile.download();
        const videoBase64 = fileToBase64(videoBuffer);
        const videoMimeType = 'video/mp4'; // Adjust based on actual file type

        // Download reference PDFs
        const pdfParts = await Promise.all(
            referenceUrls.map(async (url) => {
                const filename = url.split('/').pop().split('?')[0];
                const file = bucket.file(filename);
                const [buffer] = await file.download();
                return {
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: fileToBase64(buffer)
                    }
                };
            })
        );

        // Call Gemini API
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        summary: {
                            type: "STRING",
                            description: "A brief executive summary of the inspection findings."
                        },
                        faults: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    timestamp: { type: "STRING", description: "Time format MM:SS" },
                                    component: { type: "STRING", description: "Name of the component" },
                                    tagNumber: { type: "STRING", description: "Equipment tag number if visible, or 'Near [location]'" },
                                    faultType: { type: "STRING", description: "Short category of fault" },
                                    description: { type: "STRING", description: "Detailed description" },
                                    severity: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"] },
                                    standardGap: { type: "STRING", description: "Citation of violated standard" },
                                    recommendation: { type: "STRING", description: "Recommended action" }
                                },
                                required: ["timestamp", "component", "tagNumber", "faultType", "description", "severity", "standardGap", "recommendation"]
                            }
                        }
                    },
                    required: ["summary", "faults"]
                } as any,
                temperature: 0.2,
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
                inlineData: {
                    mimeType: videoMimeType,
                    data: videoBase64
                }
            },
            ...pdfParts,
            { text: prompt }
        ]);

        const text = result.response.text();
        const analysisResult = JSON.parse(text);

        res.json({ success: true, result: analysisResult });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Analysis failed: ' + error.message });
    }
});

// Save report to Firestore
app.post('/api/save-report', requireAuth, async (req, res) => {
    try {
        const { videoUrl, videoFileName, referenceUrls, referenceFileNames, result } = req.body;

        const reportData = {
            videoUrl,
            videoFileName,
            referenceUrls: referenceUrls || [],
            referenceFileNames: referenceFileNames || [],
            summary: result.summary,
            faults: result.faults,
            createdAt: Firestore.Timestamp.now(),
            createdBy: req.session.username
        };

        const docRef = await firestore.collection('reports').add(reportData);

        res.json({ success: true, reportId: docRef.id });
    } catch (error) {
        console.error('Save report error:', error);
        res.status(500).json({ error: 'Failed to save report' });
    }
});

// Get all reports
app.get('/api/reports', requireAuth, async (req, res) => {
    try {
        const snapshot = await firestore.collection('reports')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const reports = [];
        snapshot.forEach(doc => {
            reports.push({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt.toDate().toISOString()
            });
        });

        res.json({ success: true, reports });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Get specific report
app.get('/api/reports/:id', requireAuth, async (req, res) => {
    try {
        const doc = await firestore.collection('reports').doc(req.params.id).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({
            success: true,
            report: {
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt.toDate().toISOString()
            }
        });
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Delete report
app.delete('/api/reports/:id', requireAuth, async (req, res) => {
    try {
        await firestore.collection('reports').doc(req.params.id).delete();
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
});
