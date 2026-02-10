"use client";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { StarRating } from "./StarRating";
import { motion } from "motion/react";
import { MessageSquare, Calendar } from "lucide-react";
import { useReviewStore } from "../store/reviewStore";
import { useEffect } from "react";

export function MyReviews() {
  const { userReviews, fetchUserReviews } = useReviewStore();
const getRatingColor = (rating: number) => {
  if (rating >= 4.5) return "green";
  if (rating >= 4) return "blue";
  if (rating >= 3) return "yellow";
  if (rating <= 2) return "red";
};

const getRatingEmoji = (rating: number) => {
  if (rating >= 4.5) return "😍";
  if (rating >= 4) return "😊";
  if (rating >= 3) return "😐";
  return "😡";
};

const getGradient = (rating: number) => {
  const color = getRatingColor(rating);
  return `bg-gradient-to-r from-${color}-500/20 to-transparent`;
};


  useEffect(() => {
    fetchUserReviews();
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-semibold mb-1">My Reviews</h2>
        <p className="text-muted-foreground">
          {userReviews.length} review{userReviews.length !== 1 ? "s" : ""} given
        </p>
      </motion.div>

      {/* REVIEWS LIST */}
      <div className="space-y-4">
        {userReviews.length > 0 ? (
          userReviews.map((review, index) => (
   <motion.div
  key={review.id}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.07 }}
>
  <Card
    className={`
      shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl overflow-hidden
      border border-border relative bg-card/70 backdrop-blur-xl
      hover:-translate-y-1
    `}
  >
    {/* ✨ GRADIENT RATING STRIP ON TOP */}
    <div className={`h-2 w-full ${getGradient(review.rating)}`} />

    <CardContent className="pt-5 pb-6 space-y-4">
      
      {/* TOP SECTION */}
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">

          {/* Restaurant Avatar + Name */}
          <div className="flex items-center gap-3">
            <div
              className={`
                h-10 w-10 rounded-full flex items-center justify-center text-white font-bold 
                bg-${getRatingColor(review.rating)}-500 shadow-md
              `}
            >
              {review.restaurantName.charAt(0)}
            </div>

            <h3 className="font-semibold text-lg flex items-center gap-2">
              {review.restaurantName}
              
              {/* Animated emoji sentiment */}
              <span className="text-xl animate-bounce">{getRatingEmoji(review.rating)}</span>
            </h3>
          </div>

          {/* Date + Order badge */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="h-4 w-4" />
            <span>{review.date}</span>

            <Badge
              variant="outline"
              className={`
                text-xs ml-2 border-${getRatingColor(review.rating)}-300 
                text-${getRatingColor(review.rating)}-700
              `}
            >
              Order #{review.orderId}
            </Badge>
          </div>
        </div>

        <StarRating rating={review.rating} readonly size="sm" />
      </div>

      {/* COMMENT */}
      {review.comment && (
        <div
          className={`
            p-3 rounded-xl border flex gap-3 bg-muted/30 transition
            border-${getRatingColor(review.rating)}-200
          `}
        >
          <MessageSquare
            className={`h-4 w-4 mt-0.5 text-${getRatingColor(review.rating)}-500`}
          />
          <p className="text-sm leading-relaxed">{review.comment}</p>
        </div>
      )}

      {/* PHOTOS GRID */}
      {Array.isArray(review.photos) && review.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 pt-2">
          {review.photos.map((photo, idx) => (
            <div
              key={idx}
              className={`
                relative rounded-xl overflow-hidden border shadow-sm
                border-${getRatingColor(review.rating)}-300
                group cursor-pointer
              `}
            >
              <img
                src={photo}
                alt=""
                className="w-full h-full object-cover group-hover:scale-110 transition"
              />

              {/* Hover Overlay */}
              <div className="
                absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 
                flex items-center justify-center text-white text-sm font-medium 
                transition
              ">
                View
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ⭐ SOFT DIVIDER */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-border to-transparent mt-4" />

    </CardContent>
  </Card>
</motion.div>

          ))
        ) : (
          <Card className="border-2 rounded-xl bg-card/50 backdrop-blur">
            <CardContent className="pt-12 pb-12 text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No reviews yet</h3>
              <p className="text-muted-foreground">
                You haven't reviewed any orders yet — place an order and share your experience!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
