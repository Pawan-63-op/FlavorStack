// import { useNavigate, useLocation } from "react-router-dom";
"use client";
import { useRouter } from "next/navigation";

// import { RestaurantList } from "../RestaurantList";
import RestaurantList from "../RestaurantList";
import { useSearchParams } from "next/navigation";

export function RestaurantListWrapper() {
  // const navigate = useNavigate();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchData = {
    // query: searchParams.get("query") ,
    // type: searchParams.get("type") ,
    // cuisine: searchParams.get("cuisine") ,
        query: searchParams.get("query")  || "undefined" ,
    type: searchParams.get("type") || "undefined" ,
    cuisine: searchParams.get("cuisine") || "undefined" ,
  };
  // const location = useLocation();

  const handleNavigate = (page: string, data?: any) => {
    if (page === "restaurant" && data?.id) {
      router.push(`/restaurants/${data.id}`);
    } else {
       if (data) {
      const params = new URLSearchParams(data).toString();
      router.push(`/${page}?${params}`);
    } else {
      router.push(`/${page}`);
    }
      // navigate(`/${page}`, { state: data });
    }
  };
  return <RestaurantList searchData={searchData || {}} onNavigate={handleNavigate} />;
}
