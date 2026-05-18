/**
 * Upload Routes — Supabase Storage Integration
 * Mengunggah berkas/gambar langsung ke Supabase Storage Bucket demi kestabilan cloud
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const supabase = require('../config/supabase');

// Menggunakan memoryStorage agar file tidak disimpan di disk lokal Render yang tidak permanen
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // Batasi ukuran berkas maksimal 10MB
    }
});

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const file = req.file;
        const category = req.body.category ? `${req.body.category}/` : '';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `${category}${uniqueSuffix}${path.extname(file.originalname)}`;
        
        console.log(`[Upload] Mengunggah berkas ke Supabase Storage: ${fileName}`);
        
        // 1. Unggah buffer berkas ke Supabase Storage Bucket bernama 'uploads'
        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });
            
        if (error) {
            console.error('[Upload Error Supabase]', error.message);
            return res.status(500).json({ 
                success: false, 
                error: `Gagal upload ke Supabase: ${error.message}. Pastikan bucket 'uploads' sudah dibuat dan diset Public.` 
            });
        }
        
        // 2. Dapatkan URL Publik CDN dari berkas yang diunggah
        const { data: publicUrlData } = supabase.storage
            .from('uploads')
            .getPublicUrl(fileName);
            
        const url = publicUrlData.publicUrl;
        console.log(`[Upload Success] URL Publik: ${url}`);
        
        res.json({ success: true, url });
    } catch (err) {
        console.error('[Server Upload Error]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/uploads — Menghapus berkas langsung dari Supabase Storage berdasarkan URL Publiknya
router.delete('/', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, error: 'URL berkas wajib disertakan' });
        }

        const parts = url.split('/storage/v1/object/public/uploads/');
        if (parts.length <= 1) {
            return res.status(400).json({ success: false, error: 'URL berkas tidak valid untuk dihapus dari Supabase Storage' });
        }

        const filePath = decodeURIComponent(parts[1]);
        console.log(`[Delete] Menghapus berkas dari Supabase Storage: ${filePath}`);

        const { data, error } = await supabase.storage
            .from('uploads')
            .remove([filePath]);

        if (error) {
            console.error('[Delete Error Supabase]', error.message);
            return res.status(500).json({ success: false, error: `Gagal menghapus dari Supabase: ${error.message}` });
        }

        res.json({ success: true, message: 'Berkas berhasil dihapus dari cloud storage' });
    } catch (err) {
        console.error('[Server Delete Error]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
