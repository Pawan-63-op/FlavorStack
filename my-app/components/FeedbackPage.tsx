"use client";
// import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useRouter,useParams,usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FeedbackForm } from "./FeedbackForm";

export function FeedbackPage() {
  // const navigate = useNavigate();
  // const location = useLocation();
  const router = useRouter();
const params= useParams();
  const orderId = params.orderId as string;
// const orderId = params.orderId as string;
  // const { orderId: paramId } = useParams();

  // PARAM FIRST, STATE SECOND
  // const orderId = paramId || location.state?.orderId;

  console.log("FeedbackPage loaded with orderId:", orderId);

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
const API_END_POINT = "http://localhost:8000/api/orders/by-order-id";
  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const res = await fetch(`${API_END_POINT}/${orderId}`, {
          credentials: "include"
        });

        const data = await res.json();

        if (!res.ok) {
          toast.error(data.message || "Order not found");
          router.push("/orders");
          return;
        }

        setOrder(data);
      } catch (err) {
        console.error("Fetch order error:", err);
        
        toast.error( "Failed to fetch order");
        router.push("/orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  if (!orderId) return <p>No order ID found...</p>;

  if (loading) return <p className="text-center mt-10">Loading…</p>;

  return (
    <FeedbackForm
      restaurantId={order.restaurant._id}
      orderId={orderId}
    />
  );
}
