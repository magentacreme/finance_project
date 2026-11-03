// MUST BE THE FIRST LINE TO LOAD ENVIRONMENT VARIABLES
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// File upload setup
const upload = multer({ dest: 'uploads/' });

// Environment Variables
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SENDER_EMAIL = process.env.SENDER_EMAIL;
const SENDER_PASSWORD = process.env.SENDER_PASSWORD;

// In-memory Store for Settlement History
let settlementHistory = [];

console.log("----------------------------------------");
console.log("Server Initializing...");
console.log("Loaded SENDER_EMAIL:", SENDER_EMAIL ? SENDER_EMAIL : "❌ MISSING IN .ENV");
console.log("Loaded SENDER_PASSWORD:", SENDER_PASSWORD ? "YES (HIDDEN)" : "❌ MISSING IN .ENV");
console.log("----------------------------------------");

// Configure SMTP Transporter
const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE || 'gmail',
  auth: {
    user: SENDER_EMAIL,
    pass: SENDER_PASSWORD
  }
});

// Admin JWT Authentication Middleware
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Unauthorized access. Token missing." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: "Invalid or expired token" });
  }
};

// Helper: Draft Email Content
const draftEmailContent = (item) => {
  const deductionSection = Number(item.deductionAmount) > 0 
    ? `\n* Deduction Amount: ₹${item.deductionAmount}\n* Deduction Reason: ${item.deductionReason || 'N/A'}`
    : '';

  const commentsSection = item.comments 
    ? `\n\n--- ACCOUNTING SECTION REMARKS ---\n${item.comments}`
    : '';

  return `Dear ${item.name},

Greetings from the Accounts & Finance Section.

This is to inform you that your reimbursement claim has been processed and settled. The funds have been credited to your account.

--- SETTLEMENT SUMMARY ---
* Claim ID: ${item.claimId}
* Department: ${item.department || 'N/A'}
* Claim Category: ${item.reimbursementType}
* Claimed Amount: ₹${item.claimedAmount || 0}
* Approved Amount: ₹${item.approvedAmount || 0}${deductionSection}
* Payment Ref / UTR: ${item.paymentRefNo || 'Pending'}${commentsSection}

If you have any questions regarding this settlement, please reply to this email quoting your Claim ID (${item.claimId}).

Warm regards,
Accounts & Finance Division`;
};

// ---------------- API ROUTES ----------------

// 1. ADMIN LOGIN
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin', username }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: "Invalid Admin Credentials" });
});

// 2. GET PAST APPROVED SETTLEMENTS HISTORY
app.get('/api/history', verifyAdmin, (req, res) => {
  res.json({ success: true, history: settlementHistory });
});

// 3. CSV UPLOAD AND PARSER
app.post('/api/upload-csv', verifyAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      results.push({
        id: Date.now() + Math.random(),
        claimId: row.Claim_ID || row.claimId || `CLM-${Math.floor(Math.random() * 1000)}`,
        name: row.Name || row.name || '',
        email: row.Email || row.email || '',
        department: row.Department || row.department || '',
        reimbursementType: row.Reimbursement_Type || row.reimbursementType || 'General Claim',
        claimedAmount: row.Claimed_Amount || row.claimedAmount || '0',
        approvedAmount: row.Approved_Amount || row.approvedAmount || '0',
        deductionAmount: row.Deduction_Amount || row.deductionAmount || '0',
        deductionReason: row.Deduction_Reason || row.deductionReason || '',
        paymentRefNo: row.Payment_Ref_No || row.paymentRefNo || '',
        comments: row.Accounting_Comments || row.comments || ''
      });
    })
    .on('end', () => {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.json({ success: true, data: results });
    })
    .on('error', (err) => {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ success: false, message: err.message });
    });
});

// 4. SEND INDIVIDUAL EMAIL & LOG TO HISTORY
app.post('/api/send-individual', verifyAdmin, async (req, res) => {
  const { record } = req.body;

  if (!record || !record.email) {
    return res.status(400).json({ success: false, message: "Missing recipient details" });
  }

  try {
    await transporter.sendMail({
      from: `"Accounts Office" <${SENDER_EMAIL}>`,
      to: record.email,
      subject: `Reimbursement Settlement Advice: ${record.reimbursementType} [${record.claimId}]`,
      text: draftEmailContent(record)
    });

    // Save entry into settlement history
    const historyEntry = { ...record, sentAt: new Date().toISOString() };
    settlementHistory.unshift(historyEntry);

    res.json({ success: true, message: `Email sent successfully to ${record.email}`, entry: historyEntry });
  } catch (error) {
    console.error("Nodemailer Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. SEND BATCH EMAILS & LOG TO HISTORY
app.post('/api/send-all', verifyAdmin, async (req, res) => {
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: "No records provided" });
  }

  let successCount = 0;
  let failCount = 0;

  for (const record of records) {
    try {
      await transporter.sendMail({
        from: `"Accounts Office" <${SENDER_EMAIL}>`,
        to: record.email,
        subject: `Reimbursement Settlement Advice: ${record.reimbursementType} [${record.claimId}]`,
        text: draftEmailContent(record)
      });

      // Save to settlement history
      settlementHistory.unshift({ ...record, sentAt: new Date().toISOString() });
      successCount++;
    } catch (err) {
      console.error(`Failed to send email to ${record.email}:`, err.message);
      failCount++;
    }
  }

  res.json({
    success: true,
    message: `Batch complete! Successfully Sent: ${successCount}, Failed: ${failCount}`
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));