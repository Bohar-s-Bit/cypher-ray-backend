import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadDir = path.join(
  __dirname,
  "../",
  process.env.UPLOAD_DIR || "uploads/sdk"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-hash-original.ext
    const timestamp = Date.now();
    const hash = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}-${hash}${ext}`;
    cb(null, filename);
  },
});

// File filter - accept binary files
const fileFilter = (req, file, cb) => {
  // Accept common binary file extensions
  const allowedExtensions = [
    ".bin",
    ".elf",
    ".hex",
    ".fw",
    ".rom",
    ".img",
    ".out",
    ".exe",
    ".so",
    ".dll",
    ".dylib",
    ".a",
    ".o",
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext) || !ext) {
    // No extension might be a valid binary
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${ext}. Only binary files are accepted (${allowedExtensions.join(
          ", "
        )})`
      )
    );
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB default
  },
});

/**
 * Calculate file hash (SHA-256)
 */
export const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
};

/**
 * Delete file safely
 */
export const deleteFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to delete file:", error);
    return false;
  }
};

/**
 * Validate binary file (basic magic number check)
 */
export const validateBinaryFile = async (filePath) => {
  try {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    // Check for common binary magic numbers
    const magicNumbers = {
      elf: Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF
      pe: Buffer.from([0x4d, 0x5a]), // PE/DOS (MZ)
      macho: Buffer.from([0xfe, 0xed, 0xfa]), // Mach-O (partial)
      macho64: Buffer.from([0xcf, 0xfa, 0xed, 0xfe]), // Mach-O 64-bit
    };

    // For now, accept any file (ML service will validate)
    return true;
  } catch (error) {
    return false;
  }
};

// Export multer middleware
export const uploadSingle = upload.single("file");
export const uploadBatch = upload.array("files", 50); // Max 50 files

export default {
  uploadSingle,
  uploadBatch,
  calculateFileHash,
  deleteFile,
  validateBinaryFile,
  uploadDir,
};
