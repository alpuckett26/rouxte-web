/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Background / quit-state FCM handler. Must be registered at module scope
// (before the app mounts). The OS renders the notification UI for messages
// with a `notification` block; this handler just ensures data-only messages
// are processed without a "no task registered" crash.
messaging().setBackgroundMessageHandler(async () => {
  // No-op: in-app state resyncs on next foreground via usePushRegistration.
});

AppRegistry.registerComponent(appName, () => App);
