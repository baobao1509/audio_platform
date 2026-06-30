// Shared audio singleton to bypass iOS/Safari/Chrome autoplay restrictions
export const globalAudio = typeof window !== "undefined" ? new Audio() : null;

// Unlocks the audio element synchronously inside a user gesture (like a button click)
export function unlockAudio() {
  if (!globalAudio) return;

  // Tiny valid 1-sample silent WAV data URI to unlock audio context reliably
  const silentDataUri = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
  const originalSrc = globalAudio.src;

  console.log("[Audio] Attempting synchronous unlock on user gesture...");
  globalAudio.src = silentDataUri;
  globalAudio.play()
    .then(() => {
      globalAudio.pause();
      console.log("[Audio] Global audio element unlocked successfully!");
      // Restore the original source if there was one
      if (originalSrc && !originalSrc.startsWith("data:")) {
        globalAudio.src = originalSrc;
      }
    })
    .catch((err) => {
      console.warn("[Audio] Global audio unlock error:", err);
    });
}
