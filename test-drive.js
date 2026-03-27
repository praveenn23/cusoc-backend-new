require('dotenv').config();
const { google } = require('googleapis');

async function testDrive() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  const folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

  console.log('--- Drive Diagnostics ---');
  console.log('Email:', email);
  console.log('Folder ID:', folderId);
  console.log('Key length:', rawKey.length);

  if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    rawKey = rawKey.slice(1, -1);
    console.log('Note: Stripped wrapping quotes from private key.');
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    console.log('Verifying folder access...');
    const res = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, parents',
        supportsAllDrives: true,
    });
    console.log('✅ Found folder:', res.data.name);

    console.log('Testing file creation...');
    const testCreate = await drive.files.create({
        requestBody: { name: 'diagnostic_test.txt', parents: [folderId] },
        media: { mimeType: 'text/plain', body: 'Diagnostic test' },
        supportsAllDrives: true,
    });
    console.log('✅ File created successfully! ID:', testCreate.data.id);
    console.log('Cleaning up test file...');
    await drive.files.delete({ fileId: testCreate.data.id, supportsAllDrives: true });
    console.log('✅ Cleanup successful.');

    console.log('All clear!');

  } catch (err) {
    console.error('❌ Diagnostic Failed!');
    console.error('Error Message:', err.message);
    if (err.response && err.response.data) {
      console.error('API Response Data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testDrive().catch(err => {
  console.error('FATAL ERROR:', err);
});
