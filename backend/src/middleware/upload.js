const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const env = require('../config/env');

// file-type v22 is ESM-only; we use a cached dynamic import so the load
// happens once rather than on every request.
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
  document: ['application/pdf', 'image/jpeg', 'image/png'],
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  qrcode: ['image/jpeg', 'image/png'],
  proof: ['image/jpeg', 'image/png', 'application/pdf'],
};

const SUBDIR_BY_CATEGORY = {
  document: 'documents',
  photo: 'photos',
  qrcode: 'qrcodes',
  proof: 'proofs',
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

      // Replace the multer file object with enriched metadata for the
      // controller to persist in the database.
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

// Serve a file from the upload directory after the controller has verified
// ownership. Path is constructed entirely server-side from the DB record;
// the client never supplies a file path.
async function serveUploadedFile(res, storedName, subdir, mimeType) {
  const destDir = path.resolve(env.UPLOAD_DIR, subdir);
  const filePath = path.join(destDir, storedName);

  // Verify the resolved path is still inside the expected directory.
  if (!filePath.startsWith(destDir + path.sep)) {
    const err = new Error('Path traversal detected');
    err.status = 400;
    throw err;
  }

  res.setHeader('Content-Type', mimeType);
  // Content-Disposition: attachment forces download rather than inline render,
  // which removes the browser's ability to interpret the file as HTML/JS.
  res.setHeader('Content-Disposition', `attachment; filename="download.${storedName.split('.').pop()}"`);

  const fileBuffer = await fs.readFile(filePath);
  res.send(fileBuffer);
}

module.exports = { createUploadMiddleware, serveUploadedFile, SUBDIR_BY_CATEGORY };
