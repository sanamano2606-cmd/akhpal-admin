"use client";

/**
 * Pick a picture from the device and get a web address back.
 *
 * The Home Banners page and the Welcome Screens page each had their OWN copy
 * of this, byte for byte identical - the same 5 MB limit, the same wording, the
 * same three toasts. Two copies of one rule is how two copies come to disagree:
 * change the limit in one place and the other silently keeps the old one.
 */

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";

/** The server refuses anything larger, so stop it here with a clear message
 *  rather than sending 12 MB up a slow connection to be rejected. */
export const MAX_IMAGE_MB = 5;

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  /** Returns the uploaded address, or null if it did not work. */
  const upload = async (file: File | null): Promise<string | null> => {
    if (!file) return null;

    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      toast(
        `That picture is ${mb} MB. The largest allowed is ${MAX_IMAGE_MB} MB — please use a smaller one.`,
        "error"
      );
      return null;
    }

    setUploading(true);
    try {
      const res = (await apiClient.uploadImage(file)) as any;
      if (!res?.url) {
        toast("The picture uploaded but the server sent no address back.", "error");
        return null;
      }
      toast("Picture uploaded", "success");
      return res.url as string;
    } catch (err) {
      toast(errorMessage(err, "the picture upload"), "error");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
