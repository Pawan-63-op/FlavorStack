"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { OrderTracking } from "../OrderTracking";

export function OrderProcessingWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId       = searchParams.get("orderId");        // display ID e.g. ORD-xxx
  const orderMongoId  = searchParams.get("orderMongoId");   // MongoDB _id for polling
  const restaurantName = searchParams.get("restaurantName") || "";
  const total         = Number(searchParams.get("total") || 0);
  const pointsEarned  = Number(searchParams.get("pointsEarned") || 0);
  const deliveryTime  = searchParams.get("deliveryTime") || "30-40 min";

  if (!orderId || !orderMongoId) {
    router.push("/orders");
    return null;
  }

  return (
    <OrderTracking
      orderId={orderId}
      orderMongoId={orderMongoId}
      restaurantName={restaurantName}
      total={total}
      pointsEarned={pointsEarned}
      deliveryTime={deliveryTime}
    />
  );
}
