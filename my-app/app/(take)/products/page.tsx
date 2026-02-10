"use client";

import Link from "next/link";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
// const fetchProducts = async () => {
//   const res = await fetch("https://dummyjson.com/products");
  


//   const data = await res.json();  
//   return data.products;
// };

// export default function Products() {
//   const queryClient = useQueryClient();
//   const {
//     data:xy,
//     isLoading,
//     isError,
//     error,
//     refetch,
//   } = useQuery({
//     queryKey: ["products"],
//     queryFn: fetchProducts,
//     staleTime:  1000 *3, 
//     // cacheTime: 60 * 1000  // 1 min fresh
//     //  refetchOnWindowFocus: false,
//   });

//   // LOADING UI
//   if (isLoading) {
//     return <p>Loading products...</p>;
//   }

//   // ERROR UI
//   if (isError) {
//     return (
//       <div>
//         <p style={{ color: "red" }}>{error.message}</p>
//         <button onClick={() => refetch()}>Retry</button>
//       </div>
//     );
//   }

//   // SUCCESS UI
//   return (
//     <div>
//       <Button onClick={ () => queryClient.invalidateQueries({ queryKey: ['products'] })}> op check</Button>
//       <br /> <br />
//    {/* <Button onClick={ () => refetch()}> take down </Button> */}
//       <br /> <br />
//       <Link style={{ color: "red" }} href="/Home">Go to Admin Dashboard</Link>
//       <br /> <br />

//       <h2>Products</h2>

//       <ul>
//         {xy.map((product) => (
//           <li key={product.id}>
//             <img
//               src={product.thumbnail}
//               alt={product.title}
//               width={200}
//               height={201}
//             />
//             <h3>{product.title}</h3>
//             <p>Price: ${product.price}</p>
//             <Link style={{ color: "red" }} href={`/product?id=${product.id}`}>Details</Link>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }
// "use client";




import { keepPreviousData } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Fullscreen } from "lucide-react";

const LIMIT = 4;

async function fetchProducts(skip: number, limit: number) {
  const res = await fetch(
    `https://dummyjson.com/products?skip=${skip}&limit=${limit}`
  );
  return res.json();
}

export default function PaginationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const skip = Number(searchParams.get("skip")) || 0;
  const limit = Number(searchParams.get("limit")) || LIMIT;

  const { data, isFetching } = useQuery({
    queryKey: ["products", skip, limit],
    queryFn: () => fetchProducts(skip, limit),
    placeholderData: keepPreviousData,
    staleTime: 1000*3,
    // enabled: false,
    gcTime: 60*1000*3,
  });

  function nextPage() {
    router.push(`?skip=${skip + LIMIT}&limit=${LIMIT}`);
  }

  function prevPage() {
    router.push(`?skip=${Math.max(skip - LIMIT, 0)}&limit=${LIMIT}`);
  }
  return (
    <div style={{ maxWidth: Fullscreen }}>
      <h2>Horizontal Pagination</h2>

      {isFetching && <p>Loading new page...</p>}

      {/* 🔥 Horizontal Layout */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          overflowX: "auto",
        }}
      >
        {data?.products?.map((p: any) => (
          <div
            key={p.id}
            style={{
              minWidth: 200,
              border: "1px solid #ddd",
              padding: 10,
              borderRadius: 8,
            }}
          >
            <img
              src={p.thumbnail}
              alt={p.title}
              width={180}
              height={120}
              style={{ objectFit: "cover", borderRadius: 6 }}
            />

            <h4>{p.title}</h4>
            <p>₹{p.price}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={prevPage} disabled={skip === 0}>
          ⬅ Back
        </button>

        <button onClick={nextPage}>
          Next ➡
        </button>
      </div>

      <p>
        skip={skip} limit={limit}
      </p>
    </div>
  );
}
