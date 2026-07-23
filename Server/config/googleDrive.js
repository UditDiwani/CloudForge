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
  const clientId = getRequiredEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getRequiredEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = getRequiredEnv('GOOGLE_REDIRECT_URI');
  const refreshToken = getRequiredEnv('GOOGLE_REFRESH_TOKEN');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: 'v3', auth: oauth2Client });
};

const getConfiguredDriveFolderId = () => {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID is not defined in environment variables');
  }

  return folderId;
};

module.exports = {
  getGoogleDriveClient,
  getConfiguredDriveFolderId,
};
