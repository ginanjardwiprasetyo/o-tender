/**
 * TenderBuild — Local Uploads to Supabase Storage Migration Script
 * Membaca semua file lokal di backend/uploads dan mengunggahnya ke Supabase Storage secara otomatis.
 */
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/**
 * Scan directory recursively for all files
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;
    
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            // Keep track of the relative path inside backend/uploads
            const relativePath = path.relative(UPLOADS_DIR, fullPath);
            arrayOfFiles.push({
                fullPath,
                relativePath: relativePath.replace(/\\/g, '/') // Ensure standard web slashes
            });
        }
    });
    
    return arrayOfFiles;
}

// Map file extensions to correct MIME types
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

async function migrate() {
    console.log('🚀 Memulai migrasi berkas lokal ke Supabase Storage...');
    
    if (!fs.existsSync(UPLOADS_DIR)) {
        console.error('❌ Folder backend/uploads tidak ditemukan. Tidak ada yang perlu dimigrasi.');
        return;
    }
    
    const files = getAllFiles(UPLOADS_DIR);
    if (files.length === 0) {
        console.log('ℹ️ Folder backend/uploads kosong. Tidak ada berkas untuk dimigrasi.');
        return;
    }
    
    console.log(`📂 Ditemukan ${files.length} berkas lokal. Memulai proses upload...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const file of files) {
        try {
            console.log(`📤 Mengunggah: ${file.relativePath} ...`);
            const fileBuffer = fs.readFileSync(file.fullPath);
            const contentType = getMimeType(file.fullPath);
            
            const { data, error } = await supabase.storage
                .from('uploads')
                .upload(file.relativePath, fileBuffer, {
                    contentType,
                    upsert: true // Overwrite jika sudah ada
                });
                
            if (error) throw error;
            
            console.log(`✅ Sukses: ${file.relativePath}`);
            successCount++;
        } catch (err) {
            console.error(`❌ Gagal mengunggah ${file.relativePath}:`, err.message);
            failCount++;
        }
    }
    
    console.log('\n======================================');
    console.log('📊 RINGKASAN MIGRASI:');
    console.log(`✅ Berhasil diunggah: ${successCount} berkas`);
    console.log(`❌ Gagal diunggah: ${failCount} berkas`);
    console.log('======================================');
    console.log('💡 Selesai! Jangan lupa untuk membuat bucket "uploads" berstatus Public di dashboard Supabase.');
}

migrate();
