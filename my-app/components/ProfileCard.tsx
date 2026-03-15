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
  Cake, Briefcase, Star, Trophy, Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";

// ── Tier helper — derived purely from DB loyaltyPoints ────────────────────────
function getTierFromPoints(points: number) {
  if (points >= 5000) return { name: "Platinum", color: "bg-purple-500/10 text-purple-700 border-purple-500/20" };
  if (points >= 1500) return { name: "Gold",     color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" };
  if (points >= 500)  return { name: "Silver",   color: "bg-gray-400/10 text-gray-600 border-gray-400/20" };
  return               { name: "Bronze",  color: "bg-amber-700/10 text-amber-700 border-amber-700/20" };
}

function getPointsToNextTier(points: number) {
  if (points >= 5000) return null;
  if (points >= 1500) return { next: "Platinum", remaining: 5000 - points, total: 5000, from: 1500 };
  if (points >= 500)  return { next: "Gold",     remaining: 1500 - points, total: 1500, from: 500 };
  return               { next: "Silver",  remaining: 500  - points, total: 500,  from: 0 };
}

interface Profile {
  name: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  birthday: string;
  occupation: string;
}

const empty: Profile = {
  name: "", email: "", phone: "",
  location: "", bio: "", birthday: "", occupation: "",
};

export function ProfileCard() {
  const { user, fetchUserProfile } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>(empty);
  const [editedProfile, setEditedProfile] = useState<Profile>(empty);

  // Fetch fresh user (with loyaltyPoints) from DB on mount
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Sync local state when user loads / changes
  useEffect(() => {
    if (!user) return;
    const p: Profile = {
      name:       user.name       || "",
      email:      user.email      || "",
      phone:      user.phone      || "",
      location:   user.location   || "",
      bio:        user.bio        || "",
      birthday:   user.birthday   || "",
      occupation: user.occupation || "",
    };
    setProfile(p);
    setEditedProfile(p);
  }, [user]);

  // Points straight from DB — no store arithmetic, no welcome bonus inflation
  const loyaltyPoints = user?.loyaltyPoints ?? 0;
  const tier = getTierFromPoints(loyaltyPoints);
  const progress = getPointsToNextTier(loyaltyPoints);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("http://localhost:8000/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Email never sent — cannot be changed
        body: JSON.stringify({
          name:       editedProfile.name,
          phone:      editedProfile.phone,
          location:   editedProfile.location,
          bio:        editedProfile.bio,
          birthday:   editedProfile.birthday,
          occupation: editedProfile.occupation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update profile");

      setProfile(editedProfile);
      setIsEditing(false);
      useAuthStore.getState().setUser(data.user);
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
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
                <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200" />
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
                  <Input
                    value={editedProfile.name}
                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                    className="text-xl font-semibold w-64"
                  />
                ) : (
                  <CardTitle className="text-3xl">{profile.name}</CardTitle>
                )}
                <div className="flex gap-2 flex-wrap items-center">
                  <Badge variant="secondary" className="capitalize">
                    {user.role || "member"}
                  </Badge>
                  <Badge variant="outline" className={tier.color}>
                    <Trophy className="h-3 w-3 mr-1" />
                    {tier.name} Tier
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {loyaltyPoints.toLocaleString()} pts
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} className="gap-2">
                    <Edit className="h-4 w-4" /> Edit Profile
                  </Button>
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

            {/* Points progress bar */}
            {progress && (
              <div className="p-4 bg-accent rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Progress to <span className="font-medium text-foreground">{progress.next}</span>
                  </span>
                  <span className="font-medium">{progress.remaining.toLocaleString()} pts needed</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        ((loyaltyPoints - progress.from) / (progress.total - progress.from)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {loyaltyPoints.toLocaleString()} / {progress.total.toLocaleString()} pts
                </p>
              </div>
            )}

            {progress === null && (
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-center">
                <Trophy className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                <p className="text-sm font-medium text-purple-700">
                  You've reached Platinum — the highest tier!
                </p>
              </div>
            )}

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

            {/* Stats */}
            <div>
              <h3 className="mb-4 font-semibold">Loyalty Stats</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-accent rounded-xl">
                  <p className="text-2xl font-bold mb-1 text-primary">
                    {loyaltyPoints.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Points</p>
                </div>
                <div className="text-center p-4 bg-accent rounded-xl">
                  <p className="text-2xl font-bold mb-1">{tier.name}</p>
                  <p className="text-xs text-muted-foreground">Current Tier</p>
                </div>
                <div className="text-center p-4 bg-accent rounded-xl">
                  <p className="text-2xl font-bold mb-1 capitalize">
                    {user.role || "Member"}
                  </p>
                  <p className="text-xs text-muted-foreground">Account Role</p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
