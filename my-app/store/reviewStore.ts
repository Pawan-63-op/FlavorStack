import { create } from "zustand";
import { toast } from "sonner";

export interface Review {
  id: string;
  restaurantId: string;        // FIX: was number — MongoDB _id is always a string
  restaurantName: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  orderId: string;
  photos?: string[];
  timestamp?: any;
}

export interface ReviewState {
  reviews: Review[];
  userReviews: Review[];
  reviewedOrders: string[];

  fetchRestaurantReviews: (restaurantId: string) => Promise<void>;
  fetchUserReviews: () => Promise<void>;
  getRestaurantReviews: (restaurantId: string) => Review[];  // FIX: string
  getAverageRating: (restaurantId: string) => number;
  canUserReview: (restaurantId: string, userId: string) => boolean;
  canReview: (orderId: string) => boolean;
  addReviewedOrder: (orderId: string) => void;
  addReview: (review: Omit<Review, "id" | "timestamp" | "date" | "userId" | "userName">) => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  reviews: [],       // no more hardcoded fake reviews
  userReviews: [],
  reviewedOrders: [],

  // FIX 1: fetch real reviews from backend for a specific restaurant
  fetchRestaurantReviews: async (restaurantId: string) => {
    try {
      const res = await fetch(
        `http://localhost:8000/api/reviews/restaurant/${restaurantId}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const data = await res.json();

      // backend returns array directly (getRestaurantReviews returns res.json(reviews))
      const raw: any[] = Array.isArray(data) ? data : data.reviews || [];

      const mapped: Review[] = raw.map((r) => ({
        id:             r._id,
        restaurantId:   r.restaurant?._id?.toString() || restaurantId,
        restaurantName: r.restaurant?.restaurantName || r.restaurant?.name || "",
        userId:         r.user?._id?.toString() || "",
        userName:       r.user?.name || "Anonymous",
        rating:         r.rating,
        comment:        r.comment || "",
        date:           new Date(r.createdAt).toLocaleDateString(),
        orderId:        r.orderId || "",
        photos:         r.photos || [],
      }));

      // Replace reviews for this restaurant, keep others
      set((s) => ({
        reviews: [
          ...s.reviews.filter((r) => r.restaurantId !== restaurantId),
          ...mapped,
        ],
      }));
    } catch (err) {
      console.error("fetchRestaurantReviews error:", err);
    }
  },

  // Fetch logged-in user's own reviews
  fetchUserReviews: async () => {
    try {
      const res = await fetch("http://localhost:8000/api/reviews/myreviews", {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Failed to load reviews"); return; }

      const mapped: Review[] = data.map((r: any) => ({
        id:             r._id,
        restaurantId:   r.restaurant?._id?.toString() || "",
        restaurantName: r.restaurant?.restaurantName || "Restaurant",
        userId:         r.user?._id?.toString() || "",
        userName:       r.user?.name || "",
        rating:         r.rating,
        comment:        r.comment || "",
        date:           new Date(r.createdAt).toLocaleDateString(),
        orderId:        r.orderId || "",
        photos:         r.photos || [],
      }));

      set({ userReviews: mapped });
    } catch {
      toast.error("Something went wrong while loading reviews");
    }
  },

  // FIX 2: compare strings not number vs string
  getRestaurantReviews: (restaurantId: string) =>
    get().reviews.filter((r) => r.restaurantId === restaurantId),

  getAverageRating: (restaurantId: string) => {
    const list = get().getRestaurantReviews(restaurantId);
    if (list.length === 0) return 0;
    return list.reduce((sum, r) => sum + r.rating, 0) / list.length;
  },

  canUserReview: (restaurantId: string, userId: string) =>
    !get().reviews.some(
      (r) => r.restaurantId === restaurantId && r.userId === userId
    ),

  canReview: (orderId: string) => !get().reviewedOrders.includes(orderId),

  addReviewedOrder: (orderId: string) =>
    set((s) => ({ reviewedOrders: [...s.reviewedOrders, orderId] })),

  addReview: (reviewData) => {
    const newReview: Review = {
      ...reviewData,
      id:        `rev-${Date.now()}`,
      timestamp: Date.now(),
      date:      "Just now",
      userId:    "",
      userName:  "You",
    };
    set((s) => ({
      reviews:     [newReview, ...s.reviews],
      userReviews: [newReview, ...s.userReviews],
    }));
  },
}));
