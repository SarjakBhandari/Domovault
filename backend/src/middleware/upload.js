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
      try {
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
      } catch (err) {
        next(err);
      }
    },
  ];
}

const EXT_TO_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

// Send a stored file to the client.
// The controller calls this after verifying that the requesting user owns the file.
// The client never supplies a path - the controller looks up the DB record and
// passes us the storedName (our UUID). This means there is no way for a client
// to request an arbitrary file path.
async function serveUploadedFile(res, storedName, subdir, mimeType) {
  const destDir = path.resolve(env.UPLOAD_DIR, subdir);
  const filePath = path.join(destDir, storedName);

  // Even though storedName comes from our own database and should always be a UUID,
  // we verify that the resolved path is inside the expected directory.
  // If a database compromise ever planted a traversal in storedName (e.g. "../../etc/passwd"),
  // this check catches it before any file is read.
  if (!filePath.startsWith(destDir + path.sep)) {
    const err = new Error('Path traversal detected');
    err.status = 400;
    throw err;
  }

  // Derive the MIME type from the file extension stored in the database.
  const ext = (storedName.split('.').pop() ?? '').toLowerCase();
  const resolvedMime = mimeType ?? EXT_TO_MIME[ext] ?? 'application/octet-stream';

  // Use fs.stat to get the file size without reading the file contents.
  // This lets us send Content-Length so the browser knows how big the download is.
  const stat = await fs.stat(filePath);

  res.setHeader('Content-Type', resolvedMime);
  res.setHeader('Content-Length', stat.size);

  // Images and PDFs can display inline in the browser (safe to render).
  // Everything else is forced to download as an attachment to prevent the
  // browser from executing unknown content types.
  const safeInline = IMAGE_MIMES.has(resolvedMime) || resolvedMime === 'application/pdf';
  res.setHeader(
    'Content-Disposition',
    safeInline ? `inline; filename="file.${ext}"` : `attachment; filename="download.${ext}"`
  );

  // Stream the file to the client in chunks instead of loading the whole file
  // into memory first. A 10 MB file does not need 10 MB of heap - the stream
  // reads a chunk, sends it, frees it, reads the next chunk.
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.pipe(res);              // pipe file bytes directly to the HTTP response
    stream.on('end', resolve);     // promise resolves when the file is fully sent
    stream.on('error', reject);    // promise rejects if there is a read error
    res.on('close', () => stream.destroy()); // if the client disconnects early, stop reading the file
  });
}

module.exports = { createUploadMiddleware, serveUploadedFile, SUBDIR_BY_CATEGORY };
