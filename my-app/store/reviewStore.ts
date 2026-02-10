import { create } from "zustand";
import { toast } from "sonner";

export interface Review {
  id: string;
  restaurantId: number;
  restaurantName: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  orderId:string;
  photos?: string[];
  timestamp?:any;
}

export interface ReviewState {
  reviews: Review[];
  userReviews: Review[];
   addReview: (review: Omit<Review, "id" | "timestamp" | "date" | "userId" | "userName">) => void;
  getRestaurantReviews: (restaurantId: number) => Review[];
  getAverageRating: (restaurantId: number) => number;
  canUserReview: (restaurantId: number, userId: string) => boolean;
  reviewedOrders: string[];
  fetchUserReviews: () => Promise<void>;
   canReview: (orderId: string) => boolean;
  addReviewedOrder: (orderId: string) => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  reviews: [
    {
      id: "1",
      restaurantId: 1,
      restaurantName: "La Bella Italia",
      userId: "user1",
      userName: "John Doe",
      rating: 5,
      comment: "Amazing authentic Italian food! The pasta was perfect.",
      date: "2 days ago",
      orderId: "ORD-001",
      photos: [],
    },
    {
      id: "2",
      restaurantId: 2,
      restaurantName: "Tokyo Sushi Bar",
      userId: "user2",
      userName: "Jane Smith",
      rating: 4,
      comment: "Fresh sushi and great presentation. Slightly pricey but worth it.",
      date: "5 days ago",
      orderId: "ORD-002",
      photos: [],
    },
  ],
  userReviews: [],
  reviewedOrders:[],
fetchUserReviews: async () => {
  try {
    const res = await fetch("http://localhost:8000/api/reviews/myreviews", {
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.message || "Failed to load reviews");
      return;
    }

    // Normalize backend → frontend structure
    const mapped = data.map((r: any) => ({
      id: r._id, // convert MongoDB _id → id
      restaurantId: r.restaurant?._id,
      restaurantName: r.restaurant?.restaurantName || "Restaurant",
      userId: r.user?._id,
      userName: r.user?.name,
      rating: r.rating,
      comment: r.comment || "",
      date: new Date(r.createdAt).toLocaleDateString(),
      orderId: r.orderId || "",
      photos: r.photos || [],
    }));

    set({ userReviews: mapped });
    toast.success("Reviews loaded");
  } catch (err) {
    toast.error("Something went wrong while loading reviews");
  }
},

  // addReview: (review) => {
  //   const newReview: Review = {
  //     ...review,
  //     id: String(Date.now()),
  //     date: "Just now",
  //   };
   addReview : (reviewData: Omit<Review, "id" | "timestamp" | "date" | "userId" | "userName">) => {
      const newReview: Review = {
        ...reviewData,
        id: `rev-${Date.now()}`,
        timestamp: Date.now(),
        date: "Just now",
        userId: "user-1",
        userName: "Sarah Johnson"
      };
     
    

    set((state) => ({
      reviews: [newReview, ...state.reviews],
      userReviews: [newReview, ...state.userReviews],
    }));

    toast.success("Review submitted successfully!");
  },

  getRestaurantReviews: (restaurantId) => {
    const { reviews } = get();
    return reviews.filter((r) => r.restaurantId === restaurantId);
  },

  getAverageRating: (restaurantId) => {
    const restaurantReviews = get().getRestaurantReviews(restaurantId);
    if (restaurantReviews.length === 0) return 0;

    const sum = restaurantReviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / restaurantReviews.length;
  },

  canUserReview: (restaurantId, userId) => {
    const { reviews } = get();
    return !reviews.some(
      (r) => r.restaurantId === restaurantId && r.userId === userId
    );
  },
      addReviewedOrder: (orderId: string) => {
    set((state) => ({
      reviewedOrders: [...state.reviewedOrders, orderId],
    }));
  },
     canReview: (orderId: string) => {
    const { reviewedOrders } = get();
    return !reviewedOrders.includes(orderId);
  },

}));
