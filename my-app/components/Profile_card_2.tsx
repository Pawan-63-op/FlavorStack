// import { useState, useEffect } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
// import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
// import { Badge } from "./ui/badge";
// import { Button } from "./ui/button";
// import { Input } from "./ui/input";
// import { Label } from "./ui/label";
// import { Textarea } from "./ui/textarea";
// import { Separator } from "./ui/separator";
// import { motion } from "motion/react";
// import { Edit, Check, X } from "lucide-react";
// import { toast } from "sonner";
// import { useAuthStore } from "../store/authStore";

// export function Profile_card_2() {
//   // ✅ Separate out stable state and functions
//   const user = useAuthStore((state) => state.user);
//   const fetchUserProfile = useAuthStore((state) => state.fetchUserProfile);
//   const updateProfileStore = useAuthStore((state) => state.updateProfile);

//   const [isEditing, setIsEditing] = useState(false);
//   const [loading, setLoading] = useState(true);

//   const placeholders = {
//     name: "Your Name",
//     email: "your@email.com",
//     phone: "+1 (555) 123-4567",
//     location: "Unknown",
//     bio: "Tell us about yourself!",
//     birthday: "Not provided",
//     occupation: "Not provided",
//     avatar:
//       "https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200",
//   };

//   const [profile, setProfile] = useState(placeholders);
//   const [editedProfile, setEditedProfile] = useState(placeholders);

//   // ✅ Run only once
//   useEffect(() => {
//     const getUser = async () => {
//       await fetchUserProfile;
//     };
//     getUser();
//     // ✅ empty dependency array ensures one-time call
//   }, []); 

//   // ✅ Update when user data changes in store
//   useEffect(() => {
//     if (!user) return;

//     const newProfile = {
//       name: user.name || placeholders.name,
//       email: user.email || placeholders.email,
//       phone: user.phone || placeholders.phone,
//       location: user.location || placeholders.location,
//       bio: user.bio || placeholders.bio,
//       birthday: user.birthday || placeholders.birthday,
//       occupation: user.occupation || placeholders.occupation,
//       avatar: user.avatar || placeholders.avatar,
//     };

//     setProfile(newProfile);
//     setEditedProfile(newProfile);
//     setLoading(false);
//   }, [user]);

//   const handleSave = async () => {
//     try {
//       await updateProfileStore(editedProfile);
//       toast.success("Profile updated successfully!");
//       setIsEditing(false);
//     } catch (error: any) {
//       toast.error(error.message || "Failed to update profile");
//     }
//   };

//   const handleCancel = () => {
//     setEditedProfile(profile);
//     setIsEditing(false);
//   };

//   const displayValue = (field: keyof typeof profile) =>
//     profile[field] || placeholders[field];

//   if (loading)
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <p>Loading profile...</p>
//       </div>
//     );

//   return (
//     <div className="w-full max-w-4xl mx-auto">
//       <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
//         <Card className="border-2 shadow-xl overflow-hidden">
//           <div className="h-32 bg-gradient-to-r from-primary via-purple-600 to-pink-600 relative">
//             <div className="absolute -bottom-16 left-8">
//               <Avatar className="h-32 w-32 border-4 border-card">
//                 <AvatarImage src={displayValue("avatar")} />
//                 <AvatarFallback>{displayValue("name").charAt(0)}</AvatarFallback>
//               </Avatar>
//             </div>
//           </div>

//           <CardHeader className="pt-20 pb-6 flex justify-between items-start">
//             <div className="space-y-1">
//               {isEditing ? (
//                 <Input
//                   value={editedProfile.name}
//                   onChange={(e) =>
//                     setEditedProfile({ ...editedProfile, name: e.target.value })
//                   }
//                   className="text-2xl mb-2"
//                 />
//               ) : (
//                 <CardTitle className="text-3xl">{displayValue("name")}</CardTitle>
//               )}
//               <div className="flex gap-2">
//                 <Badge variant="secondary">{user?.role || "Member"}</Badge>
//                 <Badge
//                   variant="outline"
//                   className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
//                 >
//                   {user?.loyaltyTier || "Bronze"} Tier
//                 </Badge>
//               </div>
//             </div>

//             <div className="flex gap-2">
//               {!isEditing ? (
//                 <Button onClick={() => setIsEditing(true)} className="gap-2">
//                   <Edit className="h-4 w-4" />
//                   Edit Profile
//                 </Button>
//               ) : (
//                 <>
//                   <Button onClick={handleSave} variant="default" className="gap-2">
//                     <Check className="h-4 w-4" />
//                     Save
//                   </Button>
//                   <Button onClick={handleCancel} variant="outline" className="gap-2">
//                     <X className="h-4 w-4" />
//                     Cancel
//                   </Button>
//                 </>
//               )}
//             </div>
//           </CardHeader>

//           <CardContent className="space-y-6">
//             <div>
//               <h3 className="mb-3 font-semibold">About</h3>
//               {isEditing ? (
//                 <Textarea
//                   value={editedProfile.bio}
//                   onChange={(e) =>
//                     setEditedProfile({ ...editedProfile, bio: e.target.value })
//                   }
//                   rows={3}
//                 />
//               ) : (
//                 <p className="leading-relaxed text-muted-foreground">
//                   {displayValue("bio")}
//                 </p>
//               )}
//             </div>

//             <Separator />

//             <div>
//               <h3 className="mb-4 font-semibold">Contact Information</h3>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 <div>
//                   <Label>Email</Label>
//                   {isEditing ? (
//                     <Input
//                       type="email"
//                       value={editedProfile.email}
//                       onChange={(e) =>
//                         setEditedProfile({ ...editedProfile, email: e.target.value })
//                       }
//                     />
//                   ) : (
//                     <p>{displayValue("email")}</p>
//                   )}
//                 </div>

//                 <div>
//                   <Label>Phone</Label>
//                   {isEditing ? (
//                     <Input
//                       type="tel"
//                       value={editedProfile.phone}
//                       onChange={(e) =>
//                         setEditedProfile({ ...editedProfile, phone: e.target.value })
//                       }
//                     />
//                   ) : (
//                     <p>{displayValue("phone")}</p>
//                   )}
//                 </div>

//                 <div>
//                   <Label>Location</Label>
//                   {isEditing ? (
//                     <Input
//                       value={editedProfile.location}
//                       onChange={(e) =>
//                         setEditedProfile({ ...editedProfile, location: e.target.value })
//                       }
//                     />
//                   ) : (
//                     <p>{displayValue("location")}</p>
//                   )}
//                 </div>

//                 <div>
//                   <Label>Birthday</Label>
//                   {isEditing ? (
//                     <Input
//                       value={editedProfile.birthday}
//                       onChange={(e) =>
//                         setEditedProfile({ ...editedProfile, birthday: e.target.value })
//                       }
//                     />
//                   ) : (
//                     <p>{displayValue("birthday")}</p>
//                   )}
//                 </div>
//               </div>
//             </div>

//             <Separator />

//             <div>
//               <h3 className="font-semibold">Occupation</h3>
//               {isEditing ? (
//                 <Input
//                   value={editedProfile.occupation}
//                   onChange={(e) =>
//                     setEditedProfile({ ...editedProfile, occupation: e.target.value })
//                   }
//                 />
//               ) : (
//                 <p>{displayValue("occupation")}</p>
//               )}
//             </div>
//           </CardContent>
//         </Card>
//       </motion.div>
//     </div>
//   );
// }
import React from 'react'

// type Props = {}

const Profile_card_2 = () => {
  return (
    <div>Profile_card_2</div>
  )
}

export default Profile_card_2