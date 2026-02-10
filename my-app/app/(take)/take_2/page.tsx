"use client";
"use client";

import React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export default function Projects() {
  const fetchProjects = async () => {
    const LIMIT = 10;

    // const res = await fetch(
    //   `https://jsonplaceholder.typicode.com/posts?_page=${pageParam}&_limit=${LIMIT}`
    // );
       const res = await fetch(
      `https://jsonplaceholder.typicode.com/posts`
    );

    const data = await res.json();
return data;
    // return {
    //   data, // matches your `group.data`
    //   nextCursor: data.length === LIMIT ? pageParam + 1 : null,
    // };
  };

  const {
    data,
    error,
  
    isFetching,
    status,
  } = useQuery({
    queryKey: ["projects_2"],
    queryFn: fetchProjects,
 
  });

  if (status === "pending") return <p>Loading...</p>;
  if (status === "error") return <p>Error: {error.message}</p>;

  return (
    <>
      <h1>Projects</h1>
      <ul>
        {data.map((project) => (
          <li key={project.id}>{project.id} - {project.title}</li>
        ))}
      </ul>
      </>

    
  );
}
