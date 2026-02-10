// import { create } from "zustand";
// import { toast } from "sonner";

// export interface LoyaltyTransaction {
//   id: string;
//   date: string;
//   description: string;
//   points: number;
//   type: "earned" | "redeemed";
// }

// export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";

// interface LoyaltyState {
//   points: number;
//   tier: LoyaltyTier;
//   transactions: LoyaltyTransaction[];
//   addPoints: (points: number, description: string) => void;
//   redeemPoints: (points: number, description: string) => boolean;
//   getTierBenefits: () => string[];
  
//   getPointsToNextTier: () => number;
// }

// const TIER_THRESHOLDS = {
//   Bronze: 0,
//   Silver: 500,
//   Gold: 1500,
//   Platinum: 3000,
// };

// export const useLoyaltyStore = create<LoyaltyState>((set, get) => ({
//   points: 750,
//   tier: "Silver",
//   transactions: [
//     {
//       id: "1",
//       date: "2 days ago",
//       description: "Order at La Bella Italia",
//       points: 34,
//       type: "earned",
//     },
//     {
//       id: "2",
//       date: "5 days ago",
//       description: "Order at Tokyo Sushi Bar",
//       points: 29,
//       type: "earned",
//     },
//     {
//       id: "3",
//       date: "1 week ago",
//       description: "Redeemed for $10 discount",
//       points: -100,
//       type: "redeemed",
//     },
//   ],

//   addPoints: (points, description) => {
//     set((state) => {
//       const newPoints = state.points + points;
//       let newTier = state.tier;

//       // Calculate new tier
//       if (newPoints >= TIER_THRESHOLDS.Platinum) newTier = "Platinum";
//       else if (newPoints >= TIER_THRESHOLDS.Gold) newTier = "Gold";
//       else if (newPoints >= TIER_THRESHOLDS.Silver) newTier = "Silver";
//       else newTier = "Bronze";

//       const tierChanged = newTier !== state.tier;

//       const newTransaction: LoyaltyTransaction = {
//         id: String(state.transactions.length + 1),
//         date: "Just now",
//         description,
//         points,
//         type: "earned",
//       };

//       if (tierChanged) {
//         toast.success(`Congratulations! You've reached ${newTier} tier! 🎉`);
//       } else {
//         toast.success(`You earned ${points} loyalty points!`);
//       }

//       return {
//         points: newPoints,
//         tier: newTier,
//         transactions: [newTransaction, ...state.transactions],
//       };
//     });
//   },
import axios from "axios";
//   redeemPoints: (points, description) => {
//     const { points: currentPoints } = get();
//     if (currentPoints < points) {
//       toast.error("Insufficient loyalty points");
//       return false;
//     }

//     set((state) => {
//       const newPoints = state.points - points;
//       let newTier = state.tier;

//       // Calculate new tier
//       if (newPoints >= TIER_THRESHOLDS.Platinum) newTier = "Platinum";
//       else if (newPoints >= TIER_THRESHOLDS.Gold) newTier = "Gold";
//       else if (newPoints >= TIER_THRESHOLDS.Silver) newTier = "Silver";
//       else newTier = "Bronze";

//       const newTransaction: LoyaltyTransaction = {
//         id: String(state.transactions.length + 1),
//         date: "Just now",
//         description,
//         points: -points,
//         type: "redeemed",
//       };

//       toast.success(`Successfully redeemed ${points} points!`);

//       return {
//         points: newPoints,
//         tier: newTier,
//         transactions: [newTransaction, ...state.transactions],
//       };
//     });

//     return true;
//   },

//   getTierBenefits: () => {
//     const { tier } = get();
//     const benefits: Record<LoyaltyTier, string[]> = {
//       Bronze: ["1 point per $1 spent", "Birthday bonus"],
//       Silver: [
//         "1.5 points per $1 spent",
//         "Birthday bonus",
//         "Priority support",
//       ],
//       Gold: [
//         "2 points per $1 spent",
//         "Birthday bonus",
//         "Priority support",
//         "Free delivery on orders over $30",
//       ],
//       Platinum: [
//         "3 points per $1 spent",
//         "Birthday bonus",
//         "Priority support",
//         "Free delivery on all orders",
//         "Exclusive menu items",
//       ],
//     };
//     return benefits[tier];
//   },

//   getPointsToNextTier: () => {
//     const { points, tier } = get();
//     if (tier === "Platinum") return 0;
//     if (tier === "Gold") return TIER_THRESHOLDS.Platinum - points;
//     if (tier === "Silver") return TIER_THRESHOLDS.Gold - points;
//     return TIER_THRESHOLDS.Silver - points;
//   },
// }));
import { create } from "zustand";
import { toast } from "sonner";

export interface LoyaltyTier {
  name: string;
  minPoints: number;
  benefits: string[];
  color: string;
}

export interface PointsTransaction {
  id: string;
  type: "earned" | "redeemed";
  points: number;
  description: string;
  date: string;
  timestamp: number;
}

const tiers: LoyaltyTier[] = [
  {
    name: "Bronze",
    minPoints: 0,
    benefits: ["1 point per $1 spent", "Birthday reward"],
    color: "from-amber-700 to-amber-500"
  },
  {
    name: "Silver",
    minPoints: 500,
    benefits: [
      "1.5 points per $1 spent",
      "Free delivery once a month",
      "Priority support"
    ],
    color: "from-gray-400 to-gray-300"
  },
  {
    name: "Gold",
    minPoints: 1500,
    benefits: [
      "2 points per $1 spent",
      "Free delivery unlimited",
      "Exclusive offers",
      "Early access to new restaurants"
    ],
    color: "from-yellow-600 to-yellow-400"
  },
  {
    name: "Platinum",
    minPoints: 5000,
    benefits: [
      "3 points per $1 spent",
      "VIP concierge",
      "Premium support",
      "Special events access"
    ],
    color: "from-purple-600 to-purple-400"
  }
];

interface LoyaltyStore {
  points: number;
  transactions: PointsTransaction[];
  tier: LoyaltyTier;
  earnPoints: (amount: number, description: string) => void;
  redeemPoints: (points: number, description: string) => boolean;
  getTiers: () => LoyaltyTier[];
  getNextTier: () => LoyaltyTier | null;
  getPointsToNextTier: () => number;
  recalcTier: () => void;
  fetchLoyaltyData: () => Promise<void>;
}

export const useLoyaltyStore = create<LoyaltyStore>((set, get) => ({
  points: 750,
  transactions: [
    {
      id: "1",
      type: "earned",
      points: 250,
      description: "Order #ORD-001",
      date: "3 days ago",
      timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000
    },
    {
      id: "2",
      type: "earned",
      points: 500,
      description: "Welcome bonus",
      date: "1 week ago",
      timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000
    }
  ],
  tier:tiers[1],

  recalcTier: () => {
      const { points } = get();
      const tier = [...tiers].reverse().find(t => points >= t.minPoints) || tiers[0];
      set({ tier });
      
    },
  
fetchLoyaltyData: async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/loyalty/transactions", {
        withCredentials: true
      });

      const dbTransactions = res.data || [];

      // Convert timestamps to readable dates
      const formatted = dbTransactions.map((t: any) => ({
        ...t,
        // date: new Date(t.timestamp).toLocaleDateString()
        timestamp: new Date(t.createdAt).getTime(),
      date: new Date(t.createdAt).toLocaleDateString(),
      }));

      // Add welcome bonus logic (your original design)
      const welcomeBonus = {
        id: "WELCOME",
        type: "earned",
        points: 500,
        description: "Welcome bonus",
        date: "At signup",
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000
      };

      const allTransactions = [welcomeBonus, ...formatted];
      console.log("Fetched Transactions:", allTransactions);
// console.log("formatted:", dbTransactions);
// console.log("respone:", res.data.transactions);
      // Compute points total
      const totalPoints = allTransactions.reduce(
        (sum: number, t: PointsTransaction) => sum + t.points,
        0
      );

      set({
        points: totalPoints,
        transactions: allTransactions
      });

      get().recalcTier();
    } catch (err) {
      console.error("Failed to fetch loyalty data:", err);
    }
  },
  earnPoints: (amount, description) => {
    const earnedPoints = Math.floor(amount);
    const newPoints = get().points + earnedPoints;
    const transaction: PointsTransaction = {
      id: Date.now().toString(),
      type: "earned",
      points: earnedPoints,
      description,
      date: "Just now",
      timestamp: Date.now()
    };

    set(state => ({
      points: newPoints,
      transactions: [transaction, ...state.transactions]
    }));

    toast.success(`+${earnedPoints} points earned!`, { description });
    get().recalcTier();
  },

  redeemPoints: (pointsToRedeem, description) => {
    const { points } = get();

    if (points < pointsToRedeem) {
      toast.error("Insufficient points");
      return false;
    }

    const newPoints = points - pointsToRedeem;
    const transaction: PointsTransaction = {
      id: Date.now().toString(),
      type: "redeemed",
      points: pointsToRedeem,
      description,
      date: "Just now",
      timestamp: Date.now()
    };

    set(state => ({
      points: newPoints,
      transactions: [transaction, ...state.transactions]
    }));

    toast.success(`${pointsToRedeem} points redeemed!`);
    get().recalcTier();
    return true;
  },

  getTiers: () => tiers,

  getNextTier: () => {
 
    const { tier } = get();
    const currentIndex = tiers.findIndex(t => t.name === tier.name);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  },

  getPointsToNextTier: () => {
    const { points } = get();
    const nextTier = get().getNextTier();
    return nextTier ? nextTier.minPoints - points : 0;
  }
}));
