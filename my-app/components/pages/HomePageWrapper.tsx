// import { useNavigate } from "react-router-dom";
// import { HomePage } from "../HomePage";

// export function HomePageWrapper() {
//   const navigate = useNavigate();

//   const handleNavigate = (page: string, data?: any) => {
//     switch (page) {
//       case "restaurants":
//         navigate("/restaurants", { state: data });
//         break;
//       case "restaurant":
//         if (data?.id) {
//           navigate(`/restaurants/${data.id}`);
//         }
//         break;
//       case "recipes":
//         navigate("/recipes");
//         break;
//       default:
//         navigate(`/${page}`);
//     }
//   };

//   return <HomePage onNavigate={handleNavigate} />;
// }
