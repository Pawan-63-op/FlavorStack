// // import { useNavigate } from "react-router-dom";
// import { Checkout } from "../Checkout";
// import { useRouter } from "next/navigation";
// export function CheckoutWrapper() {
//   // const navigate = useNavigate();

//   const router = useRouter();
//   const handleNavigate = (page: string, data?: any) => {
//     if (page === "order-processing") {
//       navigate("/order-processing", { state: data });
//     } else {
//       navigate(`/${page}`, { state: data });
//     }
//   };

//   return <Checkout onNavigate={handleNavigate} />;
// }
