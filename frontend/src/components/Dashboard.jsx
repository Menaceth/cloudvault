import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { LogOut, Upload, File, Trash2, Download, Share2, Check, Cloud, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

export default function Dashboard({ user }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(null);
  const fileInputRef = useRef(null);

  // 🔥 Real-time Firestore listener — files update INSTANTLY across all devices
  useEffect(() => {
    const filesRef = collection(db, 'users', user.uid, 'files');
    const q = query(filesRef, orderBy('uploadDate', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fileList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamp to JS Date
        uploadDate: doc.data().uploadDate?.toDate?.() || new Date(),
      }));
      setFiles(fileList);
      setLoading(false);
    }, (err) => {
      console.error('Firestore listener error:', err);
      setError('Could not load files. Check Firestore rules.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const getHeaders = () => ({ Authorization: user.uid });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!API_ENDPOINT) {
      setError("API Endpoint not configured");
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      const headers = getHeaders();
      // 1. Get Pre-signed URL from Lambda
      const urlRes = await fetch(
        `${API_ENDPOINT}/files/upload?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}&fileSize=${file.size}`, 
        { headers }
      );
      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, fileId, s3Key } = await urlRes.json();

      // 2. Upload directly to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Failed to upload file to S3');

      // 3. Save metadata to Firestore (triggers real-time update on ALL devices!)
      await addDoc(collection(db, 'users', user.uid, 'files'), {
        fileId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        s3Key,
        uploadDate: serverTimestamp(),
      });

      // No need to manually reload — Firestore listener handles it automatically!
    } catch (err) {
      setError('Upload failed: ' + err.message);
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (fileId) => {
    try {
      const headers = getHeaders();
      const res = await fetch(`${API_ENDPOINT}/files/${fileId}`, { headers });
      if (!res.ok) throw new Error('Failed to get download link');
      const { downloadUrl } = await res.json();
      window.open(downloadUrl, '_blank');
    } catch (err) {
      setError('Download failed.');
    }
  };

  const handleDelete = async (file) => {
    if (!confirm(`Delete "${file.fileName}"?`)) return;
    try {
      const headers = getHeaders();
      // 1. Delete from S3 via Lambda
      const res = await fetch(`${API_ENDPOINT}/files/${file.fileId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to delete from S3');

      // 2. Delete metadata from Firestore
      await deleteDoc(doc(db, 'users', user.uid, 'files', file.id));

      // Real-time listener automatically removes it from the UI!
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
  };

  const handleShare = async (fileId) => {
    try {
      const headers = getHeaders();
      const res = await fetch(`${API_ENDPOINT}/files/${fileId}/share?expiresInHours=168`, { headers });
      if (!res.ok) throw new Error('Failed to generate share link');
      const { shareUrl } = await res.json();
      
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(fileId);
      setTimeout(() => setCopiedLink(null), 3000);
    } catch (err) {
      setError('Failed to share file.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              CloudVault
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {user.photoURL && (
                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-600" />
              )}
              <span className="text-sm font-medium text-slate-400">{user.email}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400">Live</span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700/50"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!API_ENDPOINT && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400">
            Setup Required: VITE_API_ENDPOINT is not defined in .env.
          </div>
        )}

        {/* Upload Area */}
        <div className="mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 border-dashed rounded-2xl p-8 text-center transition-colors hover:bg-slate-800/70 relative overflow-hidden group">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              disabled={uploading || !API_ENDPOINT}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            />
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
                {uploading ? (
                  <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-indigo-400" />
                )}
              </div>
              <div>
                <p className="text-lg font-medium text-slate-200">
                  {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
                </p>
                <p className="text-sm text-slate-400 mt-1">Securely encrypted in AWS S3 • Synced in real-time</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4">✕</button>
          </div>
        )}

        {/* File List */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your Files</h2>
            <span className="text-xs text-slate-500 flex items-center space-x-1">
              <RefreshCw className="w-3 h-3" />
              <span>Auto-synced via Firestore</span>
            </span>
          </div>
          
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
              Loading your files...
            </div>
          ) : files.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <File className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-300">No files yet</h3>
              <p className="text-slate-500 mt-1">Upload your first file to get started.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-700/50">
              {files.map((file) => (
                <li key={file.id} className="px-6 py-4 hover:bg-slate-700/30 transition-colors flex items-center justify-between group">
                  <div className="flex items-center space-x-4 overflow-hidden">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <File className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-slate-200 truncate">{file.fileName}</p>
                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                        <span>{formatSize(file.fileSize)}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(file.uploadDate, { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDownload(file.fileId)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Download">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleShare(file.fileId)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Copy Share Link (7 Days)">
                      {copiedLink === file.fileId ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(file)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
