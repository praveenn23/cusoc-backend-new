const { google } = require('googleapis');

/**
 * Creates an authenticated Google Drive client using a Service Account.
 * Credentials are read from environment variables.
 */
const getDriveClient = () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY || '';

  if (!email) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not set in .env');
  if (!rawKey) throw new Error('GOOGLE_PRIVATE_KEY is not set in .env');

  // 1. Remove literal double quotes if they wrap the key (common in some .env setups)
  if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    rawKey = rawKey.slice(1, -1);
  }

  // 2. Handle literal \n characters -> real newlines
  const privateKey = rawKey.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email.trim(),
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
};

/**
 * Uploads a file buffer to Google Drive.
 * @param {Buffer} fileBuffer - The file content
 * @param {string} originalName - Original filename (e.g. "proof.pdf")
 * @param {string} mimeType - MIME type (e.g. "application/pdf")
 * @returns {Promise<string>} - Shareable Google Drive view URL
 */
const uploadToDrive = async (fileBuffer, originalName, mimeType) => {
  const folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set in .env');

  console.log('📁 Uploading to folder:', folderId);
  console.log('📄 File:', originalName, '| MIME:', mimeType, '| Size:', fileBuffer.length, 'bytes');

  const drive = getDriveClient();

  // Create file on Drive
  let fileId;
  try {
    const { data } = await drive.files.create({
      requestBody: {
        name: `${Date.now()}_${originalName}`,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: require('stream').Readable.from(fileBuffer),
      },
      fields: 'id, name',
      supportsAllDrives: true, // Required if the folder is in a Shared Drive
    });
    fileId = data.id;
    console.log('✅ File uploaded to Drive, ID:', fileId);
  } catch (err) {
    console.error('❌ Drive upload error:', err.message);
    if (err.response && err.response.data) {
      console.error('   API Details:', JSON.stringify(err.response.data));
    }
    // If folder not found, provide a clearer message
    if (err.message.includes('File not found')) {
      throw new Error(`Folder not found: ${folderId}. 1) Verify the folder ID in .env matches your Drive URL. 2) Ensure the Service Account (${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}) has "Editor" access.`);
    }
    throw err;
  }

  // Make the file publicly viewable
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true, // Required for Shared Drives
    });
    console.log('✅ File made public');
  } catch (err) {
    console.error('⚠️ Could not set public permission:', err.message);
    // Non-fatal — still return the view URL
  }

  return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
};

module.exports = { uploadToDrive };
