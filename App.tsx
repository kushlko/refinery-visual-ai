import './index.css';
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Upload, FileVideo, AlertCircle, CheckCircle2, FileText, Download, Play, BarChart3, ShieldCheck, X, File as FileIcon, RotateCcw, Link as LinkIcon, Plus, LogOut, History } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Login } from './components/Login';
import { api } from './services/api';
import { AnalysisResult, AppState } from './types';

// PDF Generator
const generatePDFReport = (data: AnalysisResult, referenceFilenames: string[], referenceUrls: string[]) => {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text("Refinery Instrumentation Inspection Report", 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  const date = new Date().toLocaleDateString();
  const time = new Date().toLocaleTimeString();
  doc.text(`Generated on: ${date} at ${time}`, 14, 30);
  doc.text(`AI Engine: Gemini Pro`, 14, 35);

  let yPos = 42;

  if (referenceFilenames.length > 0) {
    doc.text(`Reference PDFs:`, 14, yPos);
    doc.setFontSize(9);
    doc.setTextColor(60);
    referenceFilenames.forEach((name) => {
      yPos += 5;
      doc.text(`- ${name}`, 20, yPos);
    });
    yPos += 7;
  }

  if (referenceUrls.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Reference URLs:`, 14, yPos);
    doc.setFontSize(9);
    doc.setTextColor(60);
    referenceUrls.forEach((url) => {
      yPos += 5;
      doc.text(`- ${url}`, 20, yPos);
    });
    yPos += 10;
  }

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Inspection Report", 14, yPos);
  yPos += 10;

  const tableData = data.inspection_report.map(record => [
    record.serial_no,
    record.timestamp,
    record.tag_number,
    record.equipment_type,
    record.fault_type,
    record.severity,
    record.corrective_action,
    record.remarks
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Time', 'Tag No.', 'Equipment', 'Fault', 'Severity', 'Corrective Action', 'Remarks']],
    body: tableData,
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 15 },
      2: { cellWidth: 20 },
      3: { cellWidth: 25 },
      4: { cellWidth: 20 },
      5: { cellWidth: 15 },
      6: { cellWidth: 35 },
      7: { cellWidth: 40 },
    },
    styles: { fontSize: 8, overflow: 'linebreak' },
    margin: { top: 10 }
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, 190, 290, { align: 'right' });
    doc.text("RefineryEye AI - Confidential Maintenance Record", 14, 290);
  }

  doc.save(`Refinery_Inspection_Report_${Date.now()}.pdf`);
};

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = "px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 shadow-lg";

  const variants = {
    primary: "bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-orange-500/50 hover:shadow-orange-600/50 border-b-4 border-orange-700 active:border-b-2",
    secondary: "bg-gradient-to-br from-blue-800 to-blue-900 text-white hover:from-blue-900 hover:to-blue-950 shadow-blue-800/50 hover:shadow-blue-900/50 border-b-4 border-blue-950 active:border-b-2",
    danger: "bg-gradient-to-br from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-red-600/50 border-b-4 border-red-800 active:border-b-2"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </>
      ) : children}
    </button>
  );
};

// Main App Component
const App: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginError, setLoginError] = useState('');

  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStorageUrl, setVideoStorageUrl] = useState<string>('');

  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referenceStorageUrls, setReferenceStorageUrls] = useState<string[]>([]);
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState<string>('');

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { authenticated } = await api.checkAuth();
      setAuthenticated(authenticated);
    } catch (error) {
      setAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      setLoginError('');
      await api.login(username, password);
      setAuthenticated(true);
    } catch (error) {
      setLoginError('Invalid username or password');
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setAuthenticated(false);
      handleReset();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 100 * 1024 * 1024) {
        setErrorMsg("Video file is too large. Please upload a video smaller than 100MB.");
        return;
      }

      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setAppState(AppState.UPLOADING);
      setUploadProgress('Uploading video...');

      try {
        const result = await api.uploadVideo(file);
        setVideoStorageUrl(result.url);
        setAppState(AppState.READY_TO_ANALYZE);
        setUploadProgress('');
        setErrorMsg(null);
      } catch (error) {
        setErrorMsg('Failed to upload video. Please try again.');
        setAppState(AppState.ERROR);
        setUploadProgress('');
      }
    }
  };

  const handleReferenceFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles = newFiles.filter(f => f.type === 'application/pdf');

      if (validFiles.length !== newFiles.length) {
        setErrorMsg("Some files were skipped. Only PDF documents are allowed.");
      } else {
        setErrorMsg(null);
      }

      setReferenceFiles(prev => [...prev, ...validFiles]);

      if (validFiles.length > 0) {
        setUploadProgress('Uploading reference documents...');
        try {
          const result = await api.uploadReferences(validFiles);
          setReferenceStorageUrls(prev => [...prev, ...result.files.map((f: any) => f.url)]);
          setUploadProgress('');
        } catch (error) {
          setErrorMsg('Failed to upload some reference files.');
          setUploadProgress('');
        }
      }
    }
  };

  const removeReferenceFile = (index: number) => {
    setReferenceFiles(prev => prev.filter((_, i) => i !== index));
    setReferenceStorageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    try {
      new URL(urlInput);
      if (!referenceUrls.includes(urlInput)) {
        setReferenceUrls(prev => [...prev, urlInput]);
        setUrlInput("");
        setErrorMsg(null);
      } else {
        setErrorMsg("This URL has already been added.");
      }
    } catch (e) {
      setErrorMsg("Please enter a valid URL including http:// or https://");
    }
  };

  const removeReferenceUrl = (index: number) => {
    setReferenceUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!videoStorageUrl) {
      setErrorMsg("Please upload a video first.");
      return;
    }

    if (referenceStorageUrls.length === 0 && referenceUrls.length === 0) {
      const confirmAnalyze = window.confirm("No reference documents or URLs provided. AI will use general best practices. Continue?");
      if (!confirmAnalyze) return;
    }

    setAppState(AppState.ANALYZING);
    setErrorMsg(null);

    try {
      const result = await api.analyze(videoStorageUrl, referenceStorageUrls, referenceUrls);
      setAnalysisResult(result.result);

      // Save report to Firestore
      await api.saveReport({
        videoUrl: videoStorageUrl,
        videoFileName: videoFile?.name || 'video',
        referenceUrls: referenceStorageUrls,
        referenceFileNames: referenceFiles.map(f => f.name),
        result: result.result
      });

      setAppState(AppState.COMPLETED);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "Analysis failed. Please try again.");
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setVideoFile(null);
    setVideoUrl(null);
    setVideoStorageUrl('');
    setReferenceFiles([]);
    setReferenceStorageUrls([]);
    setReferenceUrls([]);
    setAnalysisResult(null);
    setErrorMsg(null);
    setUploadProgress('');
  };

  const handleDownloadPDF = () => {
    if (analysisResult) {
      const filenames = referenceFiles.map(f => f.name);
      generatePDFReport(analysisResult, filenames, referenceUrls);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLogin={handleLogin} error={loginError} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-900 flex flex-col">
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-orange-600 border-b-4 border-orange-50 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 p-3 rounded-xl shadow-lg border-2 border-orange-300">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
              RefineryEye AI
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-orange-100 hidden sm:inline-block font-medium">Instrumentation Inspection Module</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {uploadProgress && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p>{uploadProgress}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Column: Input & Video */}
          <div className="lg:col-span-5 space-y-6">

            {/* Upload Video Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FileVideo className="w-4 h-4 text-blue-600" />
                  Inspection Footage
                </h2>
                {appState === AppState.COMPLETED && (
                  <button onClick={handleReset} className="text-xs text-blue-600 hover:underline">New Inspection</button>
                )}
              </div>

              <div className="p-6">
                {!videoFile ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleVideoChange}
                    />
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8 text-blue-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">Click or Drag to Upload Video</p>
                    <p className="text-xs text-slate-500 mt-1">MP4, WebM (Max 50MB)</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video shadow-md">
                      <video
                        ref={videoRef}
                        src={videoUrl || ""}
                        controls
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className={`flex items-center justify-between p-3 rounded-lg border ${appState === AppState.READY_TO_ANALYZE ? 'bg-green-50 border-green-100' :
                      appState === AppState.UPLOADING ? 'bg-blue-50 border-blue-100' :
                        appState === AppState.ERROR ? 'bg-red-50 border-red-100' :
                          'bg-slate-50 border-slate-100'
                      }`}>
                      <div className="flex items-center gap-2">
                        {appState === AppState.UPLOADING ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        ) : appState === AppState.READY_TO_ANALYZE ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : appState === AppState.ERROR ? (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        ) : (
                          <FileVideo className="w-5 h-5 text-slate-400" />
                        )}

                        <span className={`text-sm font-medium ${appState === AppState.READY_TO_ANALYZE ? 'text-green-800' :
                          appState === AppState.UPLOADING ? 'text-blue-800' :
                            appState === AppState.ERROR ? 'text-red-800' :
                              'text-slate-700'
                          }`}>
                          {appState === AppState.READY_TO_ANALYZE ? 'Video uploaded successfully' :
                            appState === AppState.UPLOADING ? 'Uploading video...' :
                              appState === AppState.ERROR ? 'Upload failed' :
                                'Video selected'}
                        </span>
                      </div>

                      <span className={`text-xs px-2 py-1 rounded ${appState === AppState.READY_TO_ANALYZE ? 'text-green-700 bg-green-200' :
                        appState === AppState.UPLOADING ? 'text-blue-700 bg-blue-200' :
                          appState === AppState.ERROR ? 'text-red-700 bg-red-200' :
                            'text-slate-600 bg-slate-200'
                        }`}>
                        {appState === AppState.READY_TO_ANALYZE ? 'Ready' :
                          appState === AppState.UPLOADING ? 'Processing' :
                            appState === AppState.ERROR ? 'Error' :
                              'Pending'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reference Documents Upload Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Reference Documents & Links
                </h2>
              </div>
              <div className="p-4 space-y-4">

                {/* PDF Upload Section */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PDF Standards</p>
                  <label className="flex items-center justify-center w-full px-4 py-3 bg-white border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-2">
                      <Upload className="w-5 h-5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600">Add PDF Document</span>
                    </div>
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      className="hidden"
                      onChange={handleReferenceFilesChange}
                    />
                  </label>
                  {referenceFiles.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto mt-1">
                      {referenceFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 text-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <span className="truncate text-slate-700 font-medium">{file.name}</span>
                          </div>
                          <button onClick={() => removeReferenceFile(index)} className="text-slate-400 hover:text-red-500 p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 my-2"></div>

                {/* URL Input Section */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Web Page Links</p>
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LinkIcon className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="https://example.com/standard"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                      />
                    </div>
                    <Button variant="secondary" onClick={handleAddUrl} className="px-3">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {referenceUrls.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto mt-1">
                      {referenceUrls.map((url, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 text-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <LinkIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="truncate text-slate-700 font-medium">{url}</span>
                          </div>
                          <button onClick={() => removeReferenceUrl(index)} className="text-slate-400 hover:text-red-500 p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Analysis Action */}
                <div className="pt-4 border-t border-slate-100 mt-2">
                  <p className="text-sm text-slate-600 mb-2">
                    {appState === AppState.READY_TO_ANALYZE
                      ? `Ready to analyze against ${referenceFiles.length} docs and ${referenceUrls.length} links?`
                      : "Upload a video to enable analysis."}
                  </p>
                  <Button
                    onClick={handleAnalyze}
                    className="w-full"
                    disabled={appState !== AppState.READY_TO_ANALYZE}
                    title={appState !== AppState.READY_TO_ANALYZE ? "Please upload a video first" : "Start Analysis"}
                  >
                    Analyze Findings
                  </Button>
                </div>

                {appState === AppState.ANALYZING && (
                  <div className="pt-4 border-t border-slate-100 mt-2">
                    <div className="bg-blue-50 p-4 rounded-lg flex flex-col items-center justify-center space-y-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-blue-700 font-medium">Analyzing frames & standards...</p>
                      <p className="text-xs text-blue-500">This may take a minute.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Analysis Results */}
          <div className="lg:col-span-7">
            {appState === AppState.COMPLETED && analysisResult ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col animate-fadeIn">

                {/* Results Header */}
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      Analysis Report
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Found {analysisResult.inspection_report.length} issues requiring attention.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={handleReset} className="text-sm">
                      <RotateCcw className="w-4 h-4" />
                      New Analysis
                    </Button>
                    <Button variant="primary" onClick={handleDownloadPDF} className="text-sm">
                      <Download className="w-4 h-4" />
                      Download PDF
                    </Button>
                  </div>
                </div>

                {/* Inspection Report Table */}
                <div className="flex-grow overflow-auto p-0">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-slate-600 w-16">#</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 w-20">Time</th>
                        <th className="px-4 py-3 font-semibold text-slate-600">Tag No.</th>
                        <th className="px-4 py-3 font-semibold text-slate-600">Equipment</th>
                        <th className="px-4 py-3 font-semibold text-slate-600">Fault</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 w-24">Severity</th>
                        <th className="px-4 py-3 font-semibold text-slate-600">Corrective Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analysisResult.inspection_report.map((record, index) => (
                        <tr key={index} className="hover:bg-slate-50 group transition-colors">
                          <td className="px-4 py-4 align-top text-center">
                            <span className="font-semibold text-slate-700">{record.serial_no}</span>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <button
                              onClick={() => {
                                if (videoRef.current) {
                                  // Parse MM:SS to seconds
                                  const parts = record.timestamp.split(':');
                                  const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                                  if (!isNaN(seconds)) {
                                    videoRef.current.currentTime = seconds;
                                    videoRef.current.play();
                                  }
                                }
                              }}
                              className="flex items-center gap-1 font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs hover:bg-blue-100"
                            >
                              <Play className="w-3 h-3" />
                              {record.timestamp}
                            </button>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className="text-sm font-medium text-slate-700">{record.tag_number}</span>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className="text-sm text-slate-700">{record.equipment_type}</span>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-800">{record.fault_type}</div>
                              <div className="text-xs text-slate-500">{record.remarks}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${record.severity === 'High' ? 'bg-red-100 text-red-800' :
                                record.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'}`}>
                              {record.severity}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className="text-xs text-slate-600">{record.corrective_action}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {analysisResult.inspection_report.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <p className="font-medium">No significant faults detected.</p>
                      <p className="text-sm">The equipment appears to meet the provided standards.</p>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* Empty State for Results */
              <div className="h-full rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-slate-50/50">
                <BarChart3 className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-slate-600">Analysis Results</h3>
                <p className="max-w-sm mt-2">
                  Upload a video and add reference documents (OISD, manuals) or URLs to start the analysis. The AI will compare findings against your inputs.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

export default App;