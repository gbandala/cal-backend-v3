import { google } from "googleapis";
import { config } from "./app.config";

//Google oauth
export const googleOAuth2Client = new google.auth.OAuth2(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  config.GOOGLE_REDIRECT_URI
);

//Zoom oauth
export const zoomOAuth2Client = {
  clientId: process.env.ZOOM_CLIENT_ID || '',
  clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
  redirectUri: process.env.ZOOM_REDIRECT_URI || '',
  authUrl: 'https://zoom.us/oauth/authorize',
  tokenUrl: 'https://zoom.us/oauth/token',
  scopes: [
    'user:read:user',
    'meeting:read:meeting', 
    'meeting:write:meeting', 
    'meeting:update:meeting', 
    'meeting:delete:meeting',  
    'zoomapp:inmeeting'
  ],
};

