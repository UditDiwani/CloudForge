const { google } = require('googleapis');

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

const getRequiredEnv = (key) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not defined in environment variables`);
  }

  return value;
};

const getGoogleDriveClient = () => {
  const clientEmail = getRequiredEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  // .env stores newlines as "\n"; Google auth requires real newline characters.
  const privateKey = getRequiredEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: DRIVE_SCOPES,
  });

  return google.drive({ version: 'v3', auth });
};

module.exports = {
  getGoogleDriveClient,
};
