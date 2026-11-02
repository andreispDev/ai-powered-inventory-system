"use client";

import { ImagePicker } from "@/modules/preferences/image-picker";
import { removeMyPhoto, setMyPhoto } from "@/modules/preferences/image-actions";

/** Your own photo. The current one shows in the profile header above this control. */
export function MyPhotoControl({ hasPhoto }: { hasPhoto: boolean }) {
  return (
    <ImagePicker
      label="Profile photo"
      hasImage={hasPhoto}
      save={setMyPhoto}
      remove={removeMyPhoto}
      preview={(picked) =>
        picked ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picked} alt="New photo preview" className="ring-border size-10 rounded-full object-cover ring-1" />
        ) : null
      }
    />
  );
}
