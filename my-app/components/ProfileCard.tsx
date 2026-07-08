"use client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";
import { motion } from "motion/react";
import {
  MapPin, Phone, Mail, Edit, Check, X,
  Cake, Briefcase, Loader2, ShieldCheck, ShieldAlert, Bell,
  Sparkles, CalendarDays, User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { isEnabled } from "@/lib/config/featureFlags";
import { emptyProfileForm, toProfileForm, type ProfileFormValues } from "./ProfileCard.helpers";

// ── "Member since" — from the server-backed `createdAt` (only real date we have) ─
function formatMemberSince(createdAt?: string): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function ProfileCard() {
  const { user, fetchUserProfile, updateProfile } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileFormValues>(emptyProfileForm);
  const [editedProfile, setEditedProfile] = useState<ProfileFormValues>(emptyProfileForm);

  // Refresh the server-backed user (name/avatar/verification/createdAt) on mount
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Sync local state when user loads / changes
  useEffect(() => {
    const p = toProfileForm(user);
    setProfile(p);
    setEditedProfile(p);
  }, [user]);

  // Loyalty is a backend stub (out of scope) — no points are served, so the
  // profile shows a "coming soon" placeholder instead of a misleading 0/Bronze.
  const memberSince = formatMemberSince(user?.createdAt);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Server-backed (name/avatar) vs local-only (rest) split happens inside
      // authStore.updateProfile — only name/avatarUrl reach server_2.
      await updateProfile({
        name: editedProfile.name,
        avatar: editedProfile.avatar,
        phone: editedProfile.phone,
        location: editedProfile.location,
        bio: editedProfile.bio,
        birthday: editedProfile.birthday,
        occupation: editedProfile.occupation,
      });
      setProfile(editedProfile);
      setIsEditing(false);
    } catch {
      // authStore.updateProfile already toasts the error.
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  // Phone — only allow digits, spaces, +, -, (, )
  const handlePhoneChange = (val: string) => {
    const cleaned = val.replace(/[^0-9\s\+\-\(\)]/g, "");
    setEditedProfile((p) => ({ ...p, phone: cleaned }));
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-2 shadow-xl overflow-hidden">

          {/* Gradient header */}
          <div className="h-36 bg-gradient-to-r from-primary via-purple-600 to-pink-600 relative">
            <div className="absolute -bottom-16 left-8">
              <Avatar className="h-32 w-32 border-4 border-card shadow-lg">
                <AvatarImage
                  src={profile.avatar || `https://api.multiavatar.com/${user?.name || "user"}.svg`}
                />
                <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                  {profile.name.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          <CardHeader className="pt-20 pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editedProfile.name}
                      onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                      className="text-xl font-semibold w-64"
                    />
                    <Input
                      value={editedProfile.avatar}
                      onChange={(e) => setEditedProfile({ ...editedProfile, avatar: e.target.value })}
                      placeholder="Avatar image URL"
                      className="w-64 text-sm"
                    />
                  </div>
                ) : (
                  <CardTitle className="text-3xl">{profile.name}</CardTitle>
                )}
                <div className="flex gap-2 flex-wrap items-center">
                  <Badge variant="secondary" className="capitalize">
                    {user.role || "member"}
                  </Badge>
                  {user.isVerified ? (
                    <Badge variant="outline" className="gap-1 text-green-700 border-green-500/30">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-amber-700 border-amber-500/30">
                      <ShieldAlert className="h-3 w-3" /> Unverified
                    </Badge>
                  )}
                  {memberSince && (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <CalendarDays className="h-3 w-3" /> Member since {memberSince}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {!isEditing ? (
                  <>
                    {isEnabled("notifications") && (
                      <Button variant="outline" className="gap-2" asChild>
                        <Link href="/profile/preferences">
                          <Bell className="h-4 w-4" /> Notifications
                        </Link>
                      </Button>
                    )}
                    <Button onClick={() => setIsEditing(true)} className="gap-2">
                      <Edit className="h-4 w-4" /> Edit Profile
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                      {isSaving
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                        : <><Check className="h-4 w-4" /> Save</>
                      }
                    </Button>
                    <Button onClick={handleCancel} variant="outline" className="gap-2">
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Loyalty — backend stub (out of scope); shown as a coming-soon teaser */}
            <div className="p-4 rounded-xl border bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">Loyalty &amp; rewards</p>
                    <p className="text-xs text-muted-foreground">
                      Earn points on every order and unlock tiers.
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" /> Coming soon
                </Badge>
              </div>
            </div>

            {/* Bio */}
            <div>
              <h3 className="mb-3 font-semibold">About</h3>
              {isEditing ? (
                <Textarea
                  value={editedProfile.bio}
                  onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                  rows={3}
                  className="resize-none"
                  placeholder="Tell us about yourself…"
                />
              ) : (
                <p className="text-muted-foreground leading-relaxed">
                  {profile.bio || "No bio yet."}
                </p>
              )}
            </div>

            <Separator />

            {/* Contact */}
            <div>
              <h3 className="mb-4 font-semibold">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Email — always read-only */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  <div className="flex items-center gap-2 pl-6">
                    <p className="text-sm">{profile.email}</p>
                    <Badge variant="outline" className="text-xs">cannot change</Badge>
                    {user.isVerified ? (
                      <Badge variant="outline" className="text-xs gap-1 text-green-700 border-green-500/30">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1 text-amber-700 border-amber-500/30">
                        <ShieldAlert className="h-3 w-3" /> Unverified
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Phone — digits only */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Phone className="h-4 w-4" /> Phone
                  </Label>
                  {isEditing ? (
                    <Input
                      type="tel"
                      value={editedProfile.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      maxLength={15}
                    />
                  ) : (
                    <p className="pl-6 text-sm">{profile.phone || "—"}</p>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-muted-foreground text-sm">
                    <MapPin className="h-4 w-4" /> Location
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.location}
                      onChange={(e) => setEditedProfile({ ...editedProfile, location: e.target.value })}
                      placeholder="City, Country"
                    />
                  ) : (
                    <p className="pl-6 text-sm">{profile.location || "—"}</p>
                  )}
                </div>

                {/* Birthday */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Cake className="h-4 w-4" /> Birthday
                  </Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editedProfile.birthday}
                      onChange={(e) => setEditedProfile({ ...editedProfile, birthday: e.target.value })}
                    />
                  ) : (
                    <p className="pl-6 text-sm">{profile.birthday || "—"}</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Occupation */}
            <div>
              <h3 className="mb-4 font-semibold">Professional Information</h3>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Briefcase className="h-4 w-4" /> Occupation
                </Label>
                {isEditing ? (
                  <Input
                    value={editedProfile.occupation}
                    onChange={(e) => setEditedProfile({ ...editedProfile, occupation: e.target.value })}
                    placeholder="Your job title or role"
                  />
                ) : (
                  <p className="pl-6 text-sm">{profile.occupation || "—"}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Account — real, server-backed details */}
            <div>
              <h3 className="mb-4 font-semibold">Account</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center gap-1 p-4 bg-accent rounded-xl text-center">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <p className="text-lg font-bold">{memberSince || "—"}</p>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                </div>
                <div className="flex flex-col items-center gap-1 p-4 bg-accent rounded-xl text-center">
                  <UserIcon className="h-5 w-5 text-primary" />
                  <p className="text-lg font-bold capitalize">{user.role || "Member"}</p>
                  <p className="text-xs text-muted-foreground">Account Role</p>
                </div>
                <div className="flex flex-col items-center gap-1 p-4 bg-accent rounded-xl text-center">
                  {user.isVerified ? (
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                  )}
                  <p className="text-lg font-bold">{user.isVerified ? "Verified" : "Unverified"}</p>
                  <p className="text-xs text-muted-foreground">Email Status</p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
