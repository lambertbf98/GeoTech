import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geotech.app',
  appName: 'GeoTech',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a237e',
      showSpinner: false
    }
  }
};

export default config;
