import type { CapacitorConfig } from '@capacitor/cli';
import { config as loadEnv } from 'dotenv';
loadEnv({ quiet: true });
const config: CapacitorConfig = {
  appId: process.env['CAPACITOR_APP_ID'] || 'com.example.ptbooking',
  appName: process.env['CAPACITOR_APP_NAME'] || 'PT Booking',
  webDir: 'www',
  plugins: { SplashScreen: { launchShowDuration: 1200, backgroundColor: '#F4F7F8', showSpinner: false }, StatusBar: { style: 'LIGHT', backgroundColor: '#F4F7F8' } }
};
export default config;
