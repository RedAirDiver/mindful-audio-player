import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  deriveKey,
  encryptAudio,
  decryptAudio,
  storeEncryptedAudio,
  getEncryptedAudio,
  getSavedTrackIds,
  removeEncryptedAudio,
} from "@/lib/audioCrypto";
import { toast } from "sonner";

// Secret salt for key derivation (in production, this could be per-user from backend)
const CRYPTO_SALT = "mt-secure-audio-2024";

interface UseOfflineAudioReturn {
  savedTracks: Set<string>;
  savingTrack: string | null;
  saveTrackOffline: (trackId: string, filePath: string, metadata: { title: string; duration: number }) => Promise<void>;
  removeTrackOffline: (trackId: string) => Promise<void>;
  getDecryptedAudioUrl: (trackId: string) => Promise<string | null>;
  isOnline: boolean;
}

export function useOfflineAudio(): UseOfflineAudioReturn {
  const { user } = useAuth();
  const [savedTracks, setSavedTracks] = useState<Set<string>>(new Set());
  const [savingTrack, setSavingTrack] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  // Initialize crypto key when user is available
  useEffect(() => {
    if (user?.id) {
      deriveKey(user.id, CRYPTO_SALT).then(setCryptoKey);
    } else {
      setCryptoKey(null);
    }
  }, [user?.id]);

  // Load saved track IDs on mount
  useEffect(() => {
    getSavedTrackIds()
      .then((ids) => setSavedTracks(new Set(ids)))
      .catch(console.error);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const saveTrackOffline = useCallback(
    async (trackId: string, filePath: string, metadata: { title: string; duration: number }) => {
      if (!user || !cryptoKey) {
        toast.error("Du måste vara inloggad för att spara offline");
        return;
      }

      setSavingTrack(trackId);

      try {
        // Get signed URL from Supabase storage
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from("audio-files")
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (urlError || !signedUrlData?.signedUrl) {
          throw new Error("Kunde inte hämta ljudfil");
        }

        // Download the audio file
        const response = await fetch(signedUrlData.signedUrl);
        if (!response.ok) {
          throw new Error("Kunde inte ladda ner ljudfil");
        }

        const audioData = await response.arrayBuffer();

        // Encrypt the audio data
        const { encrypted, iv } = await encryptAudio(audioData, cryptoKey);

        // Store encrypted data in IndexedDB
        await storeEncryptedAudio(trackId, encrypted, iv, metadata);

        // Update state
        setSavedTracks((prev) => new Set(prev).add(trackId));
        toast.success("Spåret har sparats för offline-lyssning");
      } catch (error) {
        console.error("Error saving track offline:", error);
        toast.error("Kunde inte spara spåret offline");
      } finally {
        setSavingTrack(null);
      }
    },
    [user, cryptoKey]
  );

  const removeTrackOffline = useCallback(async (trackId: string) => {
    try {
      await removeEncryptedAudio(trackId);
      setSavedTracks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(trackId);
        return newSet;
      });
      toast.success("Spåret har tagits bort från offline-lagring");
    } catch (error) {
      console.error("Error removing track:", error);
      toast.error("Kunde inte ta bort spåret");
    }
  }, []);

  const getDecryptedAudioUrl = useCallback(
    async (trackId: string): Promise<string | null> => {
      if (!cryptoKey) {
        return null;
      }

      try {
        const stored = await getEncryptedAudio(trackId);
        if (!stored) {
          return null;
        }

        // Decrypt the audio data
        const decrypted = await decryptAudio(stored.encryptedData, stored.iv, cryptoKey);

        // Create a blob URL for playback
        const blob = new Blob([decrypted], { type: "audio/mpeg" });
        return URL.createObjectURL(blob);
      } catch (error) {
        console.error("Error decrypting audio:", error);
        return null;
      }
    },
    [cryptoKey]
  );

  return {
    savedTracks,
    savingTrack,
    saveTrackOffline,
    removeTrackOffline,
    getDecryptedAudioUrl,
    isOnline,
  };
}
