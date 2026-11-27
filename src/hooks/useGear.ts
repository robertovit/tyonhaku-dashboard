import { useCallback, useState } from "react";
import { equippedPost, type PostItemId } from "../lib/post";
import { equippedShield, type ShieldId } from "../lib/shields";

// What the avatar wears is a choice made in this browser, not application data, so it lives in localStorage.
// One key per slot; the stored value is the item's stable id (never its name). The shield key is the one used
// before the post series existed, so an earlier choice is kept.
const key = (slot: "shield" | "post") => `tyonhaku:${slot}:${import.meta.env.MODE}`;

function useChoice<Id extends string>(slot: "shield" | "post") {
  const [id, setId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(key(slot));
    } catch {
      return null;
    }
  });
  const choose = useCallback(
    (next: Id | null) => {
      setId(next);
      try {
        if (next) localStorage.setItem(key(slot), next);
        else localStorage.removeItem(key(slot));
      } catch {
        /* blocked storage: the choice still holds for this visit */
      }
    },
    [slot],
  );
  return [id, choose] as const;
}

/**
 * The worn shield and post item (undefined while none is chosen or the choice is no longer earned, e.g. after
 * the demo data is reset). Both are derived again from the counts, so nothing earned is ever stored.
 */
export function useGear(rejections: number, sent: number) {
  const [shieldId, equipShield] = useChoice<ShieldId>("shield");
  const [postId, equipPost] = useChoice<PostItemId>("post");
  return {
    shield: equippedShield(shieldId, rejections),
    post: equippedPost(postId, sent),
    equipShield,
    equipPost,
  };
}
