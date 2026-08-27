/* ============================================================
   BusPal — Shared Image Utilities

   Uploaded photos are stored as base64 strings in localStorage (same
   mock-persistence approach as everything else in this app), which
   has a real size ceiling (~5-10MB total). A single unresized phone
   photo can be several MB on its own — resizing client-side before
   storing keeps four photos per bus, across a whole fleet, comfortably
   within budget without needing a real file server yet.
   ============================================================ */

const ImageUtils = (() => {

  /**
   * Reads a File, downsizes it to fit within maxWidth (preserving aspect
   * ratio, never upscales), and returns a compressed JPEG data URL.
   */
  function resizeImage(file, maxWidth = 900, quality = 0.72) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Couldn't load that image."));
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  return { resizeImage };
})();
