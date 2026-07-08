import type { User, ProfileExtras } from "@/lib/api/adapters/user";

/** Flat, editable form shape for {@link ProfileCard}. */
export interface ProfileFormValues {
  name: string;
  email: string;
  avatar: string;
  phone: string;
  location: string;
  bio: string;
  birthday: string;
  occupation: string;
}

export const emptyProfileForm: ProfileFormValues = {
  name: "",
  email: "",
  avatar: "",
  phone: "",
  location: "",
  bio: "",
  birthday: "",
  occupation: "",
};

/**
 * Maps the merged auth-store user (server-backed `User` + local
 * `ProfileExtras`) onto the flat form shape the profile card edits.
 */
export function toProfileForm(
  user: (User & Partial<ProfileExtras>) | null
): ProfileFormValues {
  if (!user) return emptyProfileForm;
  return {
    name: user.name || "",
    email: user.email || "",
    avatar: user.avatar || "",
    phone: user.phone || "",
    location: user.location || "",
    bio: user.bio || "",
    birthday: user.birthday || "",
    occupation: user.occupation || "",
  };
}
