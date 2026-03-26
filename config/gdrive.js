const { google } = require('googleapis');

/**
 * Creates an authenticated Google Drive client using a Service Account.
 * Credentials are read from environment variables.
 */
const getDriveClient = () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';

  if (!email) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not set in .env');
  if (!rawKey) throw new Error('GOOGLE_PRIVATE_KEY is not set in .env');

  // Handle both formats:
  // 1. Key stored with literal \n in .env  -> replace \\n -> \n
  // 2. Key already has real newlines (unlikely in .env but handle it)
  const privateKey = rawKey.includes('\\n')
    ? rawKey.replace(/\\n/g, '\n')
    : rawKey;

  console.log('🔑 Drive client: email =', email);
  console.log('🔑 Drive client: key starts with =', privateKey.slice(0, 40));

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
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
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set in .env');

  console.log('📁 Uploading to folder:', folderId);
  console.log('📄 File:', originalName, '| MIME:', mimeType, '| Size:', fileBuffer.length, 'bytes');

  const drive = getDriveClient();

  const { Readable } = require('stream');
  const stream = Readable.from(fileBuffer);

  // Upload the file
  let fileId;
  try {
    const { data } = await drive.files.create({
      requestBody: {
        name: `${Date.now()}_${originalName}`,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, name',
    });
    fileId = data.id;
    console.log('✅ File uploaded to Drive, ID:', fileId);
  } catch (err) {
    console.error('❌ Drive upload error:', err.message);
    console.error('   Details:', err?.response?.data || err);
    throw err;
  }

  // Make the file publicly viewable
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
    console.log('✅ File made public');
  } catch (err) {
    console.error('⚠️ Could not set public permission:', err.message);
    // Non-fatal — still return the URL
  }

  return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
};

module.exports = { uploadToDrive };
