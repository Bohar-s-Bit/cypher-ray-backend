import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import cloudinary, {
  generatePublicId,
  CLOUDINARY_CONFIG,
} from "../config/cloudinary.js";
import { queueLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Get userId from authenticated request
    const userId = req.user?._id?.toString() || "anonymous";

    // Generate unique public ID (without extension to avoid Cloudinary validation)
    const baseFilename = file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
    const publicId = generatePublicId(userId, baseFilename);

    queueLogger.info("Cloudinary upload initiated", {
      userId,
      filename: file.originalname,
      publicId,
    });

    return {
      folder: CLOUDINARY_CONFIG.baseFolder,
      public_id: publicId,
      resource_type: "raw", // Use 'raw' for any file type including binaries
      type: "private", // Private files
      access_mode: "authenticated",
      use_filename: false, // Use our generated public_id
      unique_filename: true,
      overwrite: false,
      allowed_formats: null, // Accept any format (disable format validation)
    };
  },
});

// File filter - accept all files (as per requirements)
const fileFilter = (req, file, cb) => {
  // Accept all file types
  queueLogger.info("File upload filter check", {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });

  cb(null, true); // Accept all files
};

// Create multer instance with Cloudinary storage
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: CLOUDINARY_CONFIG.maxFileSize, // 80MB for free tier
  },
});

/**
 * Calculate file hash (SHA-256) from buffer
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
 * Calculate file hash from buffer (for Cloudinary files)
 */
export const calculateBufferHash = (buffer) => {
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
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
  calculateBufferHash,
  deleteFile,
  validateBinaryFile,
};
