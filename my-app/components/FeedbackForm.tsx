import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { StarRating } from "./StarRating";
import { motion } from "motion/react";
import { Send, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface FeedbackFormProps {
  restaurantId: string;
  orderId: string;
}
export function FeedbackForm({ restaurantId, orderId }: FeedbackFormProps)  {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  // const handleSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();
    
  //   if (rating === 0) {
  //     toast.error("Please select a rating");
  //     return;
  //   }
    
  //   if (!name.trim() || !feedback.trim()) {
  //     toast.error("Please fill in all required fields");
  //     return;
  //   }

  //   // Simulate form submission
  //   toast.success("Thank you for your feedback!");
    
  //   // Reset form
  //   setRating(0);
  //   setName("");
  //   setEmail("");
  //   setFeedback("");
  //   setPhotos([]);
  // };
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  console.log("Submitting feedback:");
console.log(restaurantId,orderId,rating,feedback);
  if (rating === 0) {
    toast.error("Please select a rating");
    return;
  }

  if (!name.trim() || !feedback.trim()) {
    toast.error("Please fill in all required fields");
    return;
  }

  try {
    console
    const res = await fetch("http://localhost:8000/api/reviews", {
      method: "POST",
       credentials: "include",
      headers: {
        "Content-Type": "application/json",
      //   // Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        restaurant: restaurantId,   // must be passed as prop
        order: orderId,             // must be passed as prop
        rating,
        comment: feedback,
        photos,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.log("res",res);
      toast.error(data.message || "Failed to submit review");
      return;
    }

    toast.success("Thank you for your feedback!");

    // RESET FORM
    setRating(0);
    setName("");
    setEmail("");
    setFeedback("");
    setPhotos([]);

  } catch (error) {
    console.error(error);
    toast.error("Something went wrong!");
  }
};

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      
      if (photos.length + fileArray.length > 5) {
        toast.error("You can only upload up to 5 photos");
        return;
      }

      fileArray.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotos((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full max-w-2xl mx-auto border-2 shadow-lg">
        <CardHeader>
          <CardTitle>Share Your Feedback</CardTitle>
          <CardDescription>
            We value your opinion! Please rate your experience and share your thoughts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating Section */}
            <div className="space-y-3">
              <Label>Rating *</Label>
              <div className="flex items-center gap-4">
                <StarRating rating={rating} onRatingChange={setRating} size="lg" />
                {rating > 0 && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-muted-foreground"
                  >
                    {rating === 1 && "Poor"}
                    {rating === 2 && "Fair"}
                    {rating === 3 && "Good"}
                    {rating === 4 && "Very Good"}
                    {rating === 5 && "Excellent"}
                  </motion.span>
                )}
              </div>
            </div>

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Feedback Field */}
            <div className="space-y-2">
              <Label htmlFor="feedback">Your Feedback *</Label>
              <Textarea
                id="feedback"
                placeholder="Tell us about your experience..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                required
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-3">
              <Label>Photos (Optional)</Label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                   
                    onClick={() => document.getElementById("photo-upload")?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photos (Max 5)
                  </Button>
                  <Input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                {/* Photo Previews */}
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((photo, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative aspect-square rounded-lg overflow-hidden border-2 border-border group"
                      >
                        <img
                          src={photo}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <Button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}

                {photos.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Add photos to showcase your experience
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full shadow-md size=lg">
              <Send className="h-5 w-5 mr-2" />
              Submit Feedback
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
