import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFunctions, Functions, connectFunctionsEmulator } from "firebase/functions";

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^["']|["']$/g, "").trim();
}

function getConfig() {
  const config = {
    apiKey: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };

  if (!config.apiKey || !config.projectId) {
    throw new Error(
      "Firebase config missing. Check contracts/.env.local and restart the dev server (npm run dev)."
    );
  }

  return config;
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let functions: Functions | undefined;

function getApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK is browser-only");
  }
  if (!app) {
    app = getApps().length === 0 ? initializeApp(getConfig()) : getApps()[0];
  }
  return app;
}

export function getClientAuth(): Auth {
  if (!auth) {
    auth = getAuth(getApp());
  }
  return auth;
}

export function getFirebaseFunctions(): Functions {
  if (!functions) {
    functions = getFunctions(getApp());
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    }
  }
  return functions;
}
