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

// THE SIZE LIMIT USED TO LIVE HERE, AND IT WAS WRONG. (21 September 2026.)
// It said 5 MB, in a message that told the person "the largest allowed is
// 5 MB". The server has always accepted 10 MB, so a perfectly good 7 MB photo
// was refused for no reason - and two other screens kept their own copies of
// the same wrong number, while Create store had no check at all.
//
// There is now ONE limit, in src/lib/picture-upload.ts, and it is the server's
// own. It is applied inside apiClient.uploadImage AFTER the picture has been
// made smaller, which is the only fair place to apply it: a 12 MB photo that
// becomes 300 KB is a picture Takal is happy with.

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  /** Returns the uploaded address, or null if it did not work. */
  const upload = async (file: File | null): Promise<string | null> => {
    if (!file) return null;

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
