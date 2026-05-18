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

// DELETE /api/uploads — Menghapus berkas dari Supabase Storage ATAU Local Storage berdasarkan URL-nya
router.delete('/', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, error: 'URL berkas wajib disertakan' });
        }

        // 1. Coba hapus dari Supabase Storage jika merupakan URL Supabase
        const parts = url.split('/storage/v1/object/public/uploads/');
        if (parts.length > 1) {
            const filePath = decodeURIComponent(parts[1]);
            console.log(`[Delete] Menghapus berkas dari Supabase Storage: ${filePath}`);

            const { data, error } = await supabase.storage
                .from('uploads')
                .remove([filePath]);

            if (error) {
                console.error('[Delete Error Supabase]', error.message);
                return res.status(500).json({ success: false, error: `Gagal menghapus dari Supabase: ${error.message}` });
            }

            return res.json({ success: true, message: 'Berkas berhasil dihapus dari Supabase storage' });
        }

        // 2. Coba hapus dari Local Storage (localhost) jika merupakan URL lokal
        const localParts = url.split('/uploads/');
        if (localParts.length > 1) {
            const fs = require('fs');
            const relativePath = decodeURIComponent(localParts[1]);
            const absolutePath = path.join(__dirname, '..', 'uploads', relativePath);
            
            console.log(`[Delete Local] Menghapus berkas dari localhost disk: ${absolutePath}`);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
                return res.json({ success: true, message: 'Berkas berhasil dihapus dari localhost' });
            } else {
                return res.status(404).json({ success: false, error: 'Berkas lokal tidak ditemukan di server' });
            }
        }

        return res.status(400).json({ success: false, error: 'URL berkas tidak dikenali (bukan Supabase maupun Localhost)' });
    } catch (err) {
        console.error('[Server Delete Error]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
