const fs = require('fs').promises;
const { createReadStream } = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const env = require('../config/env');

// Limit sharp to one worker thread and disable its internal tile cache.
// Without this, sharp can hold large image buffers in memory between requests,
// which inflates peak memory usage on a server that processes many uploads.
sharp.concurrency(1);
sharp.cache(false);

let fileTypeFromBuffer;
async function getFileTypeFromBuffer() {
  if (!fileTypeFromBuffer) {
    const mod = await import('file-type');
    fileTypeFromBuffer = mod.fileTypeFromBuffer;
  }
  return fileTypeFromBuffer;
}

// Per-category lists of MIME types we will accept.
// The client's Content-Type header is completely ignored for security -
// a PHP webshell can be sent with Content-Type: image/jpeg in the header.
// Instead, we detect the real type by reading the file's magic bytes (the
// first few bytes of the file that identify its true format).
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

// These types are run through the sharp re-encoding pipeline to strip EXIF.
// Photos taken on a phone embed GPS coordinates, device model, and owner name
// in EXIF metadata. We remove all of it before the file touches disk.
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Hard cap on upload size. Multer enforces this inside the multipart parser,
// before any application code runs, so oversized files are rejected early.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function createUploadMiddleware(category) {
  const allowed = ALLOWED_MIMES[category];
  const subdir = SUBDIR_BY_CATEGORY[category];

  if (!allowed || !subdir) {
    throw new Error(`Unknown upload category: ${category}`);
  }

  // Store the uploaded file in RAM first, not on disk.
  // This lets us read the magic bytes to check the real type, and run it
  // through sharp to strip EXIF, before we ever touch the filesystem.
  // A file that fails validation is simply discarded from memory - nothing
  // gets written to disk at all.
  const multerMiddleware = multer({
    storage: multer.memoryStorage(),             // hold in RAM, not a temp file
    limits: { fileSize: MAX_FILE_BYTES, files: 1 }, // reject oversized files before we process them
  }).single('file');

  return [
    multerMiddleware,
    async (req, res, next) => {
      if (!req.file) {
        return next();
      }

      const ftFromBuffer = await getFileTypeFromBuffer();

      // Read the file's magic bytes to determine the real type.
      // The "magic bytes" are a signature at the very start of the file
      // (e.g. JPEG files always begin with FF D8 FF). This cannot be faked
      // by changing the filename extension or the Content-Type header.
      const detected = await ftFromBuffer(req.file.buffer);

      if (!detected || !allowed.includes(detected.mime)) {
        // Either we could not detect a type, or the detected type is not
        // on the allow-list for this upload category. Reject immediately.
        return res.status(400).json({
          error: `File type not allowed. Accepted types for this upload: ${allowed.join(', ')}`,
        });
      }

      // For image files, we re-encode through sharp with two goals:
      // 1. Strip all EXIF metadata (GPS, camera model, owner name, timestamps)
      // 2. Compress the image to reduce storage and bandwidth costs
      // withMetadata(false) is the key call - it tells sharp not to copy
      // any metadata from the source into the output file.
      let outputBuffer = req.file.buffer;
      if (IMAGE_MIMES.has(detected.mime)) {
        let pipeline = sharp(req.file.buffer).withMetadata(false); // strip all metadata
        if (detected.mime === 'image/jpeg') {
          // mozjpeg is a higher-quality JPEG encoder - better compression at the same visual quality
          pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
        } else if (detected.mime === 'image/png') {
          // compressionLevel 9 is maximum, effort 10 tries harder to find a smaller file
          pipeline = pipeline.png({ compressionLevel: 9, effort: 10 });
        } else if (detected.mime === 'image/webp') {
          pipeline = pipeline.webp({ quality: 80 });
        }
        outputBuffer = await pipeline.toBuffer(); // run the pipeline and collect the result
      }

      // Free the original multer buffer from memory now that we have the processed output.
      // This prevents two copies of the image data from sitting in the Node heap at once.
      req.file.buffer = null;

      // Assign a random UUID as the filename on disk.
      // The original filename from the client is thrown away - this prevents:
      // - Path traversal via filenames like "../../etc/passwd"
      // - Directory enumeration (attacker cannot guess another user's filenames)
      // - Information leakage from device-generated names like "IMG_20240601_GPS.jpg"
      const storedName = `${crypto.randomUUID()}.${detected.ext}`;
      const destDir = path.resolve(env.UPLOAD_DIR, subdir);
      const destPath = path.join(destDir, storedName);

      // Verify the destination path is still inside the expected directory.
      // This is a belt-and-suspenders check: storedName is a UUID so it cannot
      // contain ".." to escape. But if a future code change ever passes user
      // input here, this guard will catch it.
      if (!destPath.startsWith(destDir + path.sep) && destPath !== destDir) {
        return res.status(500).json({ error: 'Internal storage path error' });
      }

      await fs.mkdir(destDir, { recursive: true }); // create the directory if it doesn't exist yet
      await fs.writeFile(destPath, outputBuffer);    // write the sanitised file to disk

      const sizeBytes = outputBuffer.length;
      // Free the processed buffer immediately now that it is on disk.
      outputBuffer = null;

      req.uploadedFile = {
        storedName,
        mimeType: detected.mime,
        sizeBytes,
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

  // stat gives us Content-Length without loading the file into memory.
  const stat = await fs.stat(filePath);

  res.setHeader('Content-Type', resolvedMime);
  res.setHeader('Content-Length', stat.size);
  const safeInline = IMAGE_MIMES.has(resolvedMime) || resolvedMime === 'application/pdf';
  res.setHeader(
    'Content-Disposition',
    safeInline ? `inline; filename="file.${ext}"` : `attachment; filename="download.${ext}"`
  );

  // Stream the file in chunks instead of reading the whole thing into a
  // Buffer. This keeps memory usage flat regardless of file size or how many
  // concurrent downloads are happening.
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.pipe(res);
    stream.on('end', resolve);
    stream.on('error', reject);
    res.on('close', () => stream.destroy()); // client disconnected early
  });
}

module.exports = { createUploadMiddleware, serveUploadedFile, SUBDIR_BY_CATEGORY };
