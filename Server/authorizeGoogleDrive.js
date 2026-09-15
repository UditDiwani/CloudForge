require('dotenv').config();

const readline = require('readline');
const { google } = require('googleapis');

const requiredEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not defined in .env`);
  }

  return value;
};

const client = new google.auth.OAuth2(
  requiredEnv('GOOGLE_CLIENT_ID'),
  requiredEnv('GOOGLE_CLIENT_SECRET'),
  requiredEnv('GOOGLE_REDIRECT_URI')
);

const authorizationUrl = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
});

const readLine = (question) => {
  const interfaceHandle = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    interfaceHandle.question(question, (answer) => {
      interfaceHandle.close();
      resolve(answer.trim());
    });
  });
};

const getAuthorizationCode = (value) => {
  try {
    const parsedUrl = new URL(value);
    const code = parsedUrl.searchParams.get('code');

    if (code) {
      return code;
    }

    const error = parsedUrl.searchParams.get('error');
    throw new Error(error ? `Google returned ${error}` : 'No authorization code found in the URL');
  } catch (error) {
    if (error instanceof TypeError) {
      return value;
    }

    throw error;
  }
};

const main = async () => {
  console.log('\nOpen this URL in your browser:\n');
  console.log(authorizationUrl);
  console.log('\nAfter approving access, paste the complete redirected URL here.');
  console.log('The redirect page may show a connection error; the URL is still usable.\n');

  const redirectValue = await readLine('Redirect URL or authorization code: ');
  const code = getAuthorizationCode(redirectValue);
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Run the script again and approve consent.');
  }

  console.log('\nNew refresh token:\n');
  console.log(tokens.refresh_token);
  console.log('\nUpdate GOOGLE_REFRESH_TOKEN in Server/.env, then restart the server.');
};

main().catch((error) => {
  console.error(`\nAuthorization failed: ${error.message}`);
  process.exitCode = 1;
});
