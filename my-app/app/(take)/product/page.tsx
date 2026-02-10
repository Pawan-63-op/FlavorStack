"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

const fetchProduct = async ({ queryKey :}) => {
  const [, id] = queryKey;

  const res = await fetch(`https://dummyjson.com/products/${id}`);

  if (!res.ok) {
    throw new Error("Failed to fetch product");
  }

  return res.json();
};

export default function Products() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["product", id], // ✅ include id
    queryFn: fetchProduct,     // ✅ function reference
    enabled: !!id,             // ✅ run only when id exists
    staleTime: 10000,
    gcTime: 60 * 1000*3,
  });

  if (isLoading) return <p>Loading product...</p>;

  if (isError) {
    return (
      <div>
        <p style={{ color: "red" }}>{error.message}</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <Link href="/Home">Go to Admin Dashboard</Link>

      <h2>Product Info</h2>
<img src={data.thumbnail} alt={data.title} width={200} height={201} />
      <div>ID: {data.id}</div>
      <div>Title: {data.title}</div>
      <div>Description: {data.description}</div>
      <div>Category: {data.category}</div>
      <div>Price: ${data.price}</div>
      <div>Rating: {data.rating}</div>
      <div>Stock: {data.stock}</div>
    </div>
  );
}
