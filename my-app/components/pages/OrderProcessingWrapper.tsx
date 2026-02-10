// import { useNavigate, useLocation } from "react-router-dom";
"use client";
import { useRouter,useSearchParams } from "next/navigation";
import { OrderProcessing } from "../OrderProcessing";

export function OrderProcessingWrapper() {
  // const navigate = useNavigate();
  const router = useRouter();
  const searchParams = useSearchParams();
  // const location = useLocation();

  // const { orderId, restaurantName, total } = location.state || {};
const orderId = searchParams.get("orderId");
const restaurantName = searchParams.get("restaurantName");
// const total = searchParams.get("total") ? parseFloat(searchParams.get("total")!) : null;
const total = Number(searchParams.get("total") || 0);  
const handleComplete = () => {
    // navigate("/feedback");
    //  navigate("/feedback", { state: { orderId } });
    console.log("Navigating to feedback for orderId:", orderId);
    console.log("Final URL:", `/feedback/${orderId}`);

    // router.push(`/feedback/${orderId}`, {
    //   state: { orderId: orderId },
    // });
    router.push(`/feedback/${orderId}`);
  };

  if (!orderId) {
    router.push("/orders");
    return null;
  }

  return (
    <OrderProcessing
      orderId={orderId}
      restaurantName={restaurantName || ""}
      total={total || 0}
      onComplete={handleComplete}
    />
  );
}
