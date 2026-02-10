"use client";
import styles from "./take_1.module.css"
import React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";

/* ---------------- API (Dummy) ---------------- */

// JSONPlaceholder does NOT really save data,
// but it's perfect for learning optimistic updates.

const fetchTodos = async () => {
  const res = await fetch(
    "https://jsonplaceholder.typicode.com/todos?_limit=5"
  );
  return res.json();
};

const addTodo = async (newTodo) => {
  const res = await fetch(
    "https://jsonplaceholder.typicode.com/todos",
    {
      method: "POST",
      body: JSON.stringify(newTodo),
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return res.json();
};

/* ---------------- COMPONENT ---------------- */

export default function OptimisticTodos() {
  const queryClient = useQueryClient();

  const { data: todos = [] } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
  });

  const mutation = useMutation({
    mutationFn: addTodo,

    // 1️⃣ OPTIMISTIC UPDATE
    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({
        queryKey: ["todos"],
      });

      const previousTodos =
        queryClient.getQueryData(["todos"]);

      queryClient.setQueryData(["todos"], (old = []) => [
        ...old,
        {
          id: Date.now(), // temp id
          title: newTodo.title,
          completed: false,
          optimistic: true,
        },
      ]);

      return { previousTodos };
    },

    // 2️⃣ ROLLBACK ON ERROR
    onError: (_err, _newTodo, context) => {
      queryClient.setQueryData(
        ["todos"],
        context.previousTodos
      );
    },

    // 3️⃣ REPLACE WITH REAL DATA
    onSuccess: (savedTodo) => {
      queryClient.setQueryData(["todos"], (old = []) =>
        old.map((todo) =>
          todo.optimistic ? savedTodo : todo
        )
      );
    },
  });

  return (
    <div>
      <h2>Optimistic Update (Normal)</h2>

      <button
        onClick={() =>
          mutation.mutate({ title: "New Todo" })
        }
      >
        Add Todo
      </button>

      <ul>
        {todos.map((todo) => (
          <li className={styles.op}
            key={todo.id}
            style={{
              opacity: todo.optimistic ? 0.5 : 1,
            }}
          >
            {todo.title}
            {todo.optimistic && " (saving...)"}
          </li>
        ))}
      </ul>

    </div>
  );
}