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
import { MapPin, Phone, Mail, Edit, Check, X, Cake, Briefcase, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner"  ;
import { useAuthStore } from "@/store/authStore";
import { useEffect } from "react";

interface Profile {
  name: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  birthday: string;
  occupation: string;
  points?: number; // optional if needed
}
export function ProfileCard() {
  const {user} = useAuthStore();
  

  const [isEditing, setIsEditing] = useState(false);
  
  const [profile, setProfile] = useState({
    name: user?.name || "Sarah Johnson",
    email:  user?.email || "sarah.johnson@email.com",
    phone:  user?.phone || "+1 (555) 123-4567",
    location:  user?.location || "New York, USA",
    bio: user?.bio || "Food enthusiast and home chef. Love trying new recipes and exploring different cuisines!",
    birthday: user?.birthday || "March 15, 1992",
    occupation: user?.occupation || "Marketing Manager"
  });
 useEffect(() => {
   
  if(!user) return ;
   
  const updatedProfile = {
  name: user?.name || profile.name,
    email: user?.email ||  profile.email,
    phone: user?.phone ||  profile.phone,
    location: user?.location ||  profile.location,
    bio: user?.bio ||  profile.bio,
    birthday: user?.birthday ||  profile.birthday,
    occupation: user?.occupation ||  profile.occupation,
  };

  // Set both profile and editedProfile at the same time
  setProfile(updatedProfile);
  setEditedProfile(updatedProfile);
}, []);


 const [editedProfile, setEditedProfile] = useState<Profile>(profile);

  // const handleSave = () => {
  //   setProfile(editedProfile);
  //   setIsEditing(false);
  //   toast.success("Profile updated successfully!");
  // };
const handleSave = async () => {

  try {
    const response = await fetch("http://localhost:8000/api/auth/update-profile", {
      method: "PATCH",
    // include cookies if using auth token
      headers: {
        "Content-Type": "application/json",
      },
        credentials: "include", // 🔥 VERY IMPORTANT
      body: JSON.stringify(editedProfile),
    });

    const data = await response.json();
 
    if (!response.ok) throw new Error(data.message || "Failed to update profile");

    // ✅ Update UI
    setProfile(data.user);
    setIsEditing(false);
    await useAuthStore.getState().setUser(data.user);
    toast.success("Profile updated successfully!");

    // ✅ Update global auth store if needed

  } catch (error) {
   console.log("✅ Inside catch block");
  console.error("Full error:", error);
  toast.error("Failed to update profile");
  }
};

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  return (
    <div className="w-full max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-2 shadow-xl overflow-hidden">
          {/* Header with gradient background */}
          <div className="h-32 bg-gradient-to-r from-primary via-purple-600 to-pink-600 relative">
            <div className="absolute -bottom-16 left-8">
              <Avatar className="h-32 w-32 border-4 border-card">
                <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200" />
                <AvatarFallback className="text-4xl">{profile.name.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
          </div>

          <CardHeader className="pt-20 pb-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                {isEditing ? (
                  <Input
                    value={editedProfile.name}
                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                    className="text-2xl mb-2"
                  />
                ) : (
                  <CardTitle className="text-3xl">{profile.name}</CardTitle>
                )}
                <div className="flex gap-2">
                  <Badge variant="secondary">{user?.role } Member</Badge>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20">
                    {user?.loyaltyTier} Tier
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} className="gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleSave} variant="default" className="gap-2">
                      <Check className="h-4 w-4" />
                      Save
                    </Button>
                    <Button onClick={handleCancel} variant="outline" className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Bio Section */}
            <div>
              <h3 className="mb-3">About</h3>
              {isEditing ? (
                <Textarea
                  value={editedProfile.bio}
                  onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <p className="text-muted-foreground leading-relaxed">{profile.bio}</p>
              )}
            </div>

            <Separator />

            {/* Contact Information */}
            <div>
              <h3 className="mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editedProfile.email}
                      onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                    />
                  ) : (
                    <p className="pl-6">{profile.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    Phone
                  </Label>
                  {isEditing ? (
                    <Input
                      type="tel"
                      value={editedProfile.phone}
                      onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                    />
                  ) : (
                    <p className="pl-6">{profile.phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.location}
                      onChange={(e) => setEditedProfile({ ...editedProfile, location: e.target.value })}
                    />
                  ) : (
                    <p className="pl-6">{profile.location}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Cake className="h-4 w-4" />
                    Birthday
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.birthday}
                      onChange={(e) => setEditedProfile({ ...editedProfile, birthday: e.target.value })}
                    />
                  ) : (
                    <p className="pl-6">{profile.birthday}</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Additional Info */}
            <div>
              <h3 className="mb-4">Professional Information</h3>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Occupation
                </Label>
                {isEditing ? (
                  <Input
                    value={editedProfile.occupation}
                    onChange={(e) => setEditedProfile({ ...editedProfile, occupation: e.target.value })}
                  />
                ) : (
                  <p className="pl-6">{profile.occupation}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Stats */}
            <div>
              <h3 className="mb-4">Activity Stats</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-accent rounded-lg">
                  <p className="text-3xl mb-1">24</p>
                  <p className="text-sm text-muted-foreground">Orders</p>
                </div>
                <div className="text-center p-4 bg-accent rounded-lg">
                  <p className="text-3xl mb-1">12</p>
                  <p className="text-sm text-muted-foreground">Reviews</p>
                </div>
                <div className="text-center p-4 bg-accent rounded-lg">
                  <p className="text-3xl mb-1">750</p>
                  <p className="text-sm text-muted-foreground">Points</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
