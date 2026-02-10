// import { useNavigate, useParams } from "react-router-dom";
"use client";
import { useRouter,useParams } from "next/navigation";
// import { RestaurantDetail } from "../RestaurantDetail";
import RestaurantDetail from "../RestaurantDetail";
export function RestaurantDetailWrapper() {
  // const navigate = useNavigate();
  const router = useRouter();
  const params = useParams();
  // const { id } = useParams<{ id: string }>();
  const { id } = params as { id: string };

  const handleNavigate = (page: string, data?: any) => {
    // console.log("Navigating to:",`/${page}` , "with data:", data);
    // navigate(`/${page}`, { state: data });
    router.push(`/${page}`);
  };

  return <RestaurantDetail restaurantId={id} onNavigate={handleNavigate} />;
}
