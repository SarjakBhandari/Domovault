const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const env = require('../config/env');

let fileTypeFromBuffer;
async function getFileTypeFromBuffer() {
  if (!fileTypeFromBuffer) {
    const mod = await import('file-type');
    fileTypeFromBuffer = mod.fileTypeFromBuffer;
  }
  return fileTypeFromBuffer;
}

// Detected MIME types that we accept per upload category. The client-supplied
// Content-Type header is ignored; the file's actual bytes (magic bytes) are
// checked instead. If the detected MIME does not match the allow-list, the
// file is rejected and never written to disk.
const ALLOWED_MIMES = {
  document: ['image/jpeg', 'image/png', 'image/webp'],
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  qrcode: ['image/jpeg', 'image/png'],
  proof: ['image/jpeg', 'image/png', 'image/webp'],
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
};

const SUBDIR_BY_CATEGORY = {
  document: 'documents',
  photo: 'photos',
  qrcode: 'qrcodes',
  proof: 'proofs',
  avatar: 'avatars',
};

// Image MIME types that are re-encoded through sharp to strip all EXIF
// metadata (location, device info, etc.) before writing to disk.
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// 10 MB upper bound for all uploads. Multer enforces this in the multipart
// parser before the file reaches application code.
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function createUploadMiddleware(category) {
  const allowed = ALLOWED_MIMES[category];
  const subdir = SUBDIR_BY_CATEGORY[category];

  if (!allowed || !subdir) {
    throw new Error(`Unknown upload category: ${category}`);
  }

  // Buffer in memory first so magic-byte validation and EXIF stripping can
  // happen before anything touches disk.
  const multerMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  }).single('file');

  return [
    multerMiddleware,
    async (req, res, next) => {
      if (!req.file) {
        return next();
      }

      const ftFromBuffer = await getFileTypeFromBuffer();
      const detected = await ftFromBuffer(req.file.buffer);

      if (!detected || !allowed.includes(detected.mime)) {
        return res.status(400).json({
          error: `File type not allowed. Accepted types for this upload: ${allowed.join(', ')}`,
        });
      }

      // Re-encode images to strip EXIF metadata (GPS, device info, etc.).
      // PDFs are written as-is; they don't carry EXIF.
      let outputBuffer = req.file.buffer;
      if (IMAGE_MIMES.has(detected.mime)) {
        outputBuffer = await sharp(req.file.buffer).withMetadata(false).toBuffer();
      }

      // Store using a random UUID filename so the original filename is never
      // reflected on disk and cannot be exploited for path traversal.
      const storedName = `${crypto.randomUUID()}.${detected.ext}`;
      const destDir = path.resolve(env.UPLOAD_DIR, subdir);
      const destPath = path.join(destDir, storedName);

      // Defense-in-depth: verify the resolved path stays inside destDir even
      // though storedName is our own UUID (path.join cannot escape, but this
      // guard documents the invariant explicitly).
      if (!destPath.startsWith(destDir + path.sep) && destPath !== destDir) {
        return res.status(500).json({ error: 'Internal storage path error' });
      }

      await fs.mkdir(destDir, { recursive: true });
      await fs.writeFile(destPath, outputBuffer);

      req.uploadedFile = {
        storedName,
        mimeType: detected.mime,
        sizeBytes: outputBuffer.length,
        uploadedAt: new Date(),
      };

      next();
    },
  ];
}

const EXT_TO_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

// Serve a file from the upload directory after the controller has verified
// ownership. Path is constructed entirely server-side from the DB record;
// the client never supplies a file path. mimeType is optional  -  derived from
// the stored filename extension when omitted.
async function serveUploadedFile(res, storedName, subdir, mimeType) {
  const destDir = path.resolve(env.UPLOAD_DIR, subdir);
  const filePath = path.join(destDir, storedName);

  // Verify the resolved path is still inside the expected directory.
  if (!filePath.startsWith(destDir + path.sep)) {
    const err = new Error('Path traversal detected');
    err.status = 400;
    throw err;
  }

  const ext = (storedName.split('.').pop() ?? '').toLowerCase();
  const resolvedMime = mimeType ?? EXT_TO_MIME[ext] ?? 'application/octet-stream';

  res.setHeader('Content-Type', resolvedMime);
  const safeInline = IMAGE_MIMES.has(resolvedMime) || resolvedMime === 'application/pdf';
  res.setHeader(
    'Content-Disposition',
    safeInline ? `inline; filename="file.${ext}"` : `attachment; filename="download.${ext}"`
  );

  const fileBuffer = await fs.readFile(filePath);
  res.send(fileBuffer);
}

module.exports = { createUploadMiddleware, serveUploadedFile, SUBDIR_BY_CATEGORY };
