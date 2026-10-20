/**
 * TenderBuild — Google Drive client (Service Account).
 * Kredensial: GOOGLE_SA_JSON (inline, untuk Docker/Render) atau GOOGLE_SA_KEYFILE (path file, lokal).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { google } = require('googleapis');

let drive = null, docs = null, authInstance = null;

function getAuth() {
    if (authInstance) return authInstance;
    const inlineJson = process.env.GOOGLE_SA_JSON;
    const keyFile = process.env.GOOGLE_SA_KEYFILE
        ? path.resolve(__dirname, '..', process.env.GOOGLE_SA_KEYFILE)
        : null;
    if (!inlineJson && !keyFile) throw new Error('Kredensial Google belum dikonfigurasi (GOOGLE_SA_JSON / GOOGLE_SA_KEYFILE)');
    authInstance = new google.auth.GoogleAuth({
        ...(inlineJson ? { credentials: JSON.parse(inlineJson) } : { keyFile }),
        scopes: ['https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/documents.readonly'],
    });
    return authInstance;
}

function getDrive() {
    if (drive) return drive;
    drive = google.drive({ version: 'v3', auth: getAuth() });
    return drive;
}

function getDocs() {
    if (docs) return docs;
    docs = google.docs({ version: 'v1', auth: getAuth() });
    return docs;
}

/** Struktur section (orientasi/margin per section) — bahan render multi-segment. */
async function fetchDocStructure(gdocId) {
    const { data } = await getDocs().documents.get({
        documentId: gdocId,
        fields: 'body(content),documentStyle',
    });
    return data;
}

/** Export Google Doc → HTML ({{variabel}} dipertahankan sebagai teks). */
async function exportDocHtml(gdocId) {
    return fetchHtml(gdocId);
}

const GDOC_MIME = 'application/vnd.google-apps.document';

/** Ambil HTML dari Google Docs native. File DOCX sengaja ditolak (minta pemilik Save as Google Docs dulu). */
async function fetchHtml(fileId) {
    const d = getDrive();
    const meta = await d.files.get({ fileId, fields: 'id,name,mimeType,modifiedTime' });
    if (meta.data.mimeType !== GDOC_MIME) {
        throw new Error(`File "${meta.data.name}" bukan Google Docs — buka di Docs lalu File → Save as Google Docs`);
    }
    const res = await d.files.export({ fileId, mimeType: 'text/html' }, { responseType: 'text' });
    return { name: meta.data.name, modifiedTime: meta.data.modifiedTime, html: String(res.data) };
}

/** Daftar Google Docs native dalam satu folder (untuk picker/sync template). */
async function listDocs(folderId) {
    const d = getDrive();
    const res = await d.files.list({
        q: `'${folderId}' in parents and trashed=false and mimeType='${GDOC_MIME}'`,
        fields: 'files(id,name,modifiedTime)',
        orderBy: 'name',
        pageSize: 100,
    });
    return res.data.files || [];
}

/** Daftar isi folder Drive (folder & file) — untuk browse dokpil. */
async function listFiles(folderId, opts = {}) {
    const d = getDrive();
    const q = opts.query
        ? `'${folderId}' in parents and trashed=false and (${opts.query})`
        : `'${folderId}' in parents and trashed=false`;
    const res = await d.files.list({
        q,
        fields: 'files(id,name,mimeType,modifiedTime,size)',
        orderBy: 'name',
        pageSize: opts.pageSize || 100,
        pageToken: opts.pageToken,
    });
    return { files: res.data.files || [], nextPageToken: res.data.nextPageToken };
}

/** Metadata satu file. */
async function getFileMeta(fileId) {
    const d = getDrive();
    const { data } = await d.files.get({ fileId, fields: 'id,name,mimeType,modifiedTime,size' });
    return data;
}

/** Download file (PDF/dll) sebagai Buffer. */
async function downloadFile(fileId) {
    const d = getDrive();
    const res = await d.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
}

module.exports = { getDrive, getDocs, exportDocHtml, fetchHtml, fetchDocStructure, listDocs, listFiles, getFileMeta, downloadFile };
