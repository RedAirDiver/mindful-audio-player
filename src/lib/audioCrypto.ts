// Crypto utilities for encrypting/decrypting audio files
// Uses Web Crypto API for AES-GCM encryption

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

// Generate a deterministic key from user ID + secret
export async function deriveKey(userId: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + salt),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('mentaltraning-audio-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt audio data
export async function encryptAudio(
  audioData: ArrayBuffer,
  key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    audioData
  );
  
  return { encrypted, iv };
}

// Decrypt audio data
export async function decryptAudio(
  encryptedData: ArrayBuffer,
  iv: Uint8Array,
  key: CryptoKey
): Promise<ArrayBuffer> {
  // Create a new ArrayBuffer-backed Uint8Array to avoid SharedArrayBuffer issues
  const ivBuffer = new Uint8Array(iv.length);
  ivBuffer.set(iv);
  
  return crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer },
    key,
    encryptedData
  );
}

// Store encrypted audio in IndexedDB
export async function storeEncryptedAudio(
  trackId: string,
  encryptedData: ArrayBuffer,
  iv: Uint8Array,
  metadata: { title: string; duration: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mentaltraning-audio', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('audio')) {
        db.createObjectStore('audio', { keyPath: 'trackId' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('audio', 'readwrite');
      const store = transaction.objectStore('audio');
      
      store.put({
        trackId,
        encryptedData,
        iv: Array.from(iv), // Store as array for serialization
        metadata,
        savedAt: Date.now(),
      });
      
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
}

// Get encrypted audio from IndexedDB
export async function getEncryptedAudio(
  trackId: string
): Promise<{ encryptedData: ArrayBuffer; iv: Uint8Array; metadata: { title: string; duration: number } } | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mentaltraning-audio', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('audio')) {
        db.createObjectStore('audio', { keyPath: 'trackId' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('audio', 'readonly');
      const store = transaction.objectStore('audio');
      const getRequest = store.get(trackId);
      
      getRequest.onsuccess = () => {
        db.close();
        if (getRequest.result) {
          resolve({
            encryptedData: getRequest.result.encryptedData,
            iv: new Uint8Array(getRequest.result.iv),
            metadata: getRequest.result.metadata,
          });
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };
  });
}

// Check if track is saved offline
export async function isTrackSavedOffline(trackId: string): Promise<boolean> {
  const data = await getEncryptedAudio(trackId);
  return data !== null;
}

// Remove encrypted audio from IndexedDB
export async function removeEncryptedAudio(trackId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mentaltraning-audio', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('audio', 'readwrite');
      const store = transaction.objectStore('audio');
      
      store.delete(trackId);
      
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
}

// Get all saved track IDs
export async function getSavedTrackIds(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mentaltraning-audio', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('audio')) {
        db.createObjectStore('audio', { keyPath: 'trackId' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('audio', 'readonly');
      const store = transaction.objectStore('audio');
      const getAllRequest = store.getAllKeys();
      
      getAllRequest.onsuccess = () => {
        db.close();
        resolve(getAllRequest.result as string[]);
      };
      getAllRequest.onerror = () => {
        db.close();
        reject(getAllRequest.error);
      };
    };
  });
}
