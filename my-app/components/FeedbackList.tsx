"use client";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { StarRating } from "./StarRating";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "./ui/badge";
import { ThumbsUp, Filter, SlidersHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";


interface Feedback {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  date: string;
  timestamp: number;
  comment: string;
  helpful: number;
  verified: boolean;
  photos?: string[];
}

const mockFeedbacks: Feedback[] = [
  {
    id: 1,
    name: "Michael Chen",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHBlcnNvbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc2MDExMDU5OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    rating: 5,
    date: "2 days ago",
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
    comment: "Absolutely fantastic service! The team went above and beyond my expectations. The attention to detail and professional approach made all the difference. Highly recommended!",
    helpful: 24,
    verified: true,
    photos: [
      "https://images.unsplash.com/photo-1610985737638-7893f3155a66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9kdWN0JTIwcmV2aWV3JTIwcGhvdG98ZW58MXx8fHwxNzYwMTIyNzM1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      "https://images.unsplash.com/photo-1715635845783-7404fae223f9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXN0b21lciUyMHNlcnZpY2UlMjBleHBlcmllbmNlfGVufDF8fHx8MTc2MDEyMjczNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
    ]
  },
  {
    id: 2,
    name: "Emily Rodriguez",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbnxlbnwxfHx8fDE3NjAxMTA1OTl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    rating: 4,
    date: "5 days ago",
    timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
    comment: "Great experience overall! The process was smooth and efficient. Would have given 5 stars if the response time was a bit faster, but still very satisfied with the outcome.",
    helpful: 18,
    verified: true
  },
  {
    id: 3,
    name: "David Thompson",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW58ZW58MXx8fHwxNzYwMTEwNjAwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    rating: 5,
    date: "1 week ago",
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    comment: "Exceptional quality and outstanding customer service. The team was responsive, knowledgeable, and delivered exactly what was promised. Will definitely use their services again!",
    helpful: 31,
    verified: true,
    photos: [
      "https://images.unsplash.com/photo-1590698933947-a202b069a861?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGN1c3RvbWVyfGVufDF8fHx8MTc2MDAyMDA0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
    ]
  },
  {
    id: 4,
    name: "Sarah Williams",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbnxlbnwxfHx8fDE3NjAxMTA1OTl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    rating: 3,
    date: "1 week ago",
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    comment: "Good service but there's room for improvement. The final result met my basic expectations, though I feel some aspects could have been handled better.",
    helpful: 12,
    verified: false
  },
  {
    id: 5,
    name: "James Anderson",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW58ZW58MXx8fHwxNzYwMTEwNjAwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    rating: 5,
    date: "2 weeks ago",
    timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000,
    comment: "Top-notch professionalism! Every interaction was pleasant and productive. The results exceeded my expectations, and I appreciated the regular updates throughout the process.",
    helpful: 27,
    verified: true
  }
];

type SortOption = "recent" | "rating" | "helpful";

export function FeedbackList() {
  const [helpfulClicks, setHelpfulClicks] = useState<Record<number, boolean>>({});
  const [filterRating, setFilterRating] = useState<number | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const handleHelpfulClick = (id: number) => {
    setHelpfulClicks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filter and sort feedbacks
  const filteredAndSortedFeedbacks = useMemo(() => {
    let filtered = mockFeedbacks;

    // Filter by rating
    if (filterRating !== "all") {
      filtered = filtered.filter(f => f.rating === filterRating);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return b.rating - a.rating;
        case "helpful":
          const aHelpful = a.helpful + (helpfulClicks[a.id] ? 1 : 0);
          const bHelpful = b.helpful + (helpfulClicks[b.id] ? 1 : 0);
          return bHelpful - aHelpful;
        case "recent":
        default:
          return b.timestamp - a.timestamp;
      }
    });

    return sorted;
  }, [filterRating, sortBy, helpfulClicks]);

  const averageRating = (mockFeedbacks.reduce((acc, f) => acc + f.rating, 0) / mockFeedbacks.length).toFixed(1);
  const totalReviews = mockFeedbacks.length;

  // Count ratings
  const ratingCounts = mockFeedbacks.reduce((acc, f) => {
    acc[f.rating] = (acc[f.rating] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header with Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-2 shadow-lg bg-gradient-to-br from-primary/5 to-purple-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <h2 className="mb-2">Customer Reviews</h2>
                <p className="text-muted-foreground">See what our customers are saying</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl">{averageRating}</span>
                  <span className="text-muted-foreground">/ 5.0</span>
                </div>
                <StarRating rating={Math.round(parseFloat(averageRating))} readonly size="md" />
                <p className="text-sm text-muted-foreground">Based on {totalReviews} reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters and Sort */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="border-2 shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Filter by Rating */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Filter by Rating</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filterRating === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterRating("all")}
                  >
                    All ({totalReviews})
                  </Button>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <Button
                      key={rating}
                      variant={filterRating === rating ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterRating(rating)}
                      className="gap-1"
                    >
                      {rating} ⭐ ({ratingCounts[rating] || 0})
                    </Button>
                  ))}
                </div>
              </div>

              {/* Sort by */}
              <div className="sm:w-48">
                <div className="flex items-center gap-2 mb-3">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Sort by</span>
                </div>
                <Select value={sortBy} onValueChange={(value:any) => setSortBy(value as SortOption)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="rating">Highest Rating</SelectItem>
                    <SelectItem value="helpful">Most Helpful</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedFeedbacks.length} of {totalReviews} reviews
      </div>

      {/* Feedback Cards */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-4">
          {filteredAndSortedFeedbacks.map((feedback, index) => (
            <motion.div
              key={feedback.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={feedback.avatar} alt={feedback.name} />
                      <AvatarFallback>{feedback.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4>{feedback.name}</h4>
                          {feedback.verified && (
                            <Badge variant="secondary" className="text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">{feedback.date}</span>
                      </div>

                      <StarRating rating={feedback.rating} readonly size="sm" />

                      <p className="text-muted-foreground leading-relaxed">
                        {feedback.comment}
                      </p>

                      {/* Photos */}
                      {feedback.photos && feedback.photos.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {feedback.photos.map((photo, photoIndex) => (
                            <motion.div
                              key={photoIndex}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
                            >
                              <img
                                src={photo}
                                alt={`Review photo ${photoIndex + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </motion.div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant={helpfulClicks[feedback.id] ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleHelpfulClick(feedback.id)}
                          className="text-sm"
                        >
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Helpful ({feedback.helpful + (helpfulClicks[feedback.id] ? 1 : 0)})
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* No results message */}
      {filteredAndSortedFeedbacks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <p className="text-muted-foreground">No reviews found with the selected filters.</p>
          <Button
            variant="outline"
            onClick={() => setFilterRating("all")}
            className="mt-4"
          >
            Clear Filters
          </Button>
        </motion.div>
      )}
    </div>
  );
}
