import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";

for (const sub of ["exams", "payment-proofs", "news", "curricula", "schedules", "certificate-templates"]) {
  fs.mkdirSync(path.join(UPLOAD_DIR, sub), { recursive: true });
}

// Strict allowlists — checked on BOTH the declared mimetype and the file
// extension, since mimetype is entirely client-supplied (trivially spoofed
// by anyone crafting a raw multipart request) and is not proof of actual
// file content. This is not full magic-byte content sniffing, but it closes
// the easy version of the attack (e.g. mislabeling a script as an image)
// without adding a new dependency.
//
// SVG is deliberately excluded from "images" even though browsers treat it
// as an image type — an SVG can carry an embedded <script>, and while it
// won't execute when only ever used as an <img src>, several pages in this
// app render uploaded images behind a plain link
// (target="_blank", e.g. payment-proof "View" links) — a direct top-level
// navigation to an SVG DOES execute any embedded script in that response's
// origin. Simplest fix is to just never accept SVG here.
const IMAGE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};
const PDF_TYPES = { "application/pdf": [".pdf"] };

function safeExtname(filename) {
  return path.extname(filename || "").toLowerCase();
}

function storageFor(subdir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, subdir)),
    filename: (req, file, cb) => {
      // crypto.randomBytes, not Math.random() — filenames end up in
      // (mostly) unauthenticated-by-obscurity URLs, so they need real
      // entropy, not a predictable PRNG.
      const unique = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}`;
      cb(null, `${unique}${safeExtname(file.originalname)}`);
    },
  });
}

function allowlistFilter(allowedTypes, label) {
  return (req, file, cb) => {
    const allowedExts = allowedTypes[file.mimetype];
    const ext = safeExtname(file.originalname);
    if (!allowedExts || !allowedExts.includes(ext)) {
      return cb(new Error(`Only ${label} files are allowed`));
    }
    cb(null, true);
  };
}

const pdfOnly = allowlistFilter(PDF_TYPES, "PDF");
const imageOnly = allowlistFilter(IMAGE_TYPES, "image (JPEG/PNG/WEBP/GIF)");

const PDF_LIMITS = { fileSize: 15 * 1024 * 1024 }; // 15MB
const IMAGE_LIMITS = { fileSize: 5 * 1024 * 1024 }; // 5MB per image

export const uploadExamPdf = multer({ storage: storageFor("exams"), fileFilter: pdfOnly, limits: PDF_LIMITS });
export const uploadCurriculumPdf = multer({ storage: storageFor("curricula"), fileFilter: pdfOnly, limits: PDF_LIMITS });
export const uploadSchedulePdf = multer({ storage: storageFor("schedules"), fileFilter: pdfOnly, limits: PDF_LIMITS });
export const uploadPaymentProof = multer({ storage: storageFor("payment-proofs"), fileFilter: imageOnly, limits: IMAGE_LIMITS });
export const uploadNewsImage = multer({ storage: storageFor("news"), fileFilter: imageOnly, limits: IMAGE_LIMITS });
export const uploadCertificateTemplate = multer({ storage: storageFor("certificate-templates"), fileFilter: imageOnly, limits: IMAGE_LIMITS });

// Build the public URL path for a file multer just saved.
export function publicUrlFor(subdir, filename) {
  return `/uploads/${subdir}/${filename}`;
}
