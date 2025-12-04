// API base URL - will be same origin in production
const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080';

export const api = {
    // Authentication
    async login(username: string, password: string) {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error('Login failed');
        return res.json();
    },

    async logout() {
        const res = await fetch(`${API_BASE}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        return res.json();
    },

    async checkAuth() {
        const res = await fetch(`${API_BASE}/api/auth/status`, {
            credentials: 'include'
        });
        return res.json();
    },

    // File uploads
    async uploadVideo(file: File) {
        console.log('Starting local upload:', { name: file.name, size: file.size, type: file.type });

        const formData = new FormData();
        formData.append('video', file);

        const res = await fetch(`${API_BASE}/api/upload-video`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('Upload failed:', res.status, res.statusText, errorData);
            throw new Error(errorData.error || 'Failed to upload video file');
        }

        const data = await res.json();
        console.log('Upload successful:', data);

        return { url: data.url };
    },

    async uploadReferences(files: File[]) {
        const formData = new FormData();
        files.forEach(file => formData.append('references', file));

        const res = await fetch(`${API_BASE}/api/upload-references`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!res.ok) throw new Error('Reference upload failed');
        return res.json();
    },

    // Analysis
    async analyze(videoUrl: string, referenceUrls: string[], referenceUrlsList: string[]) {
        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ videoUrl, referenceUrls, referenceUrlsList })
        });
        if (!res.ok) throw new Error('Analysis failed');
        return res.json();
    },

    // Reports
    async saveReport(data: any) {
        const res = await fetch(`${API_BASE}/api/save-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Save report failed');
        return res.json();
    },

    async getReports() {
        const res = await fetch(`${API_BASE}/api/reports`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Fetch reports failed');
        return res.json();
    },

    async getReport(id: string) {
        const res = await fetch(`${API_BASE}/api/reports/${id}`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Fetch report failed');
        return res.json();
    },

    async deleteReport(id: string) {
        const res = await fetch(`${API_BASE}/api/reports/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Delete report failed');
        return res.json();
    }
};
