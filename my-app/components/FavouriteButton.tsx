// "use client"

// import type React from "react"

// import { Heart } from "lucide-react"
// import { useFavoritesStore } from "@/store/favoritesStore";
// import { useState } from "react"
// import { Button } from "./ui/button";

// interface FavoriteHeartProps {
//   recipeId: number
//   recipeName: string
//   recipeCategory: string
//   className?: string
// }

// export function FavoriteHeart({ recipeId, recipeName, recipeCategory, className = "h-5 w-5" }: FavoriteHeartProps) {
//   const { isFavoriteRecipe, toggleFavoriteRecipe } = useFavoritesStore()
//   const [isAnimating, setIsAnimating] = useState(false)

//   const isFavorite = isFavoriteRecipe(recipeId)

//   const handleClick = (e: React.MouseEvent) => {
//     e.preventDefault()
//     e.stopPropagation()

//     setIsAnimating(true)
//     setTimeout(() => setIsAnimating(false), 300)

//     toggleFavoriteRecipe({
//       id: recipeId,
//       name: recipeName,
//       category: recipeCategory,
//     })
//   }

//   return (
//     <Button
//       onClick={handleClick}
//       className="inline-flex items-center justify-center rounded-full p-1 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
//       aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
//       aria-pressed={isFavorite}
//     >
//       <Heart
//         className={`${className} ${
//           isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"
//         } transition-all duration-200 ${isAnimating ? "scale-125" : "scale-100"}`}
//       />
//     </Button>
//   )
// }
"use client"

import type React from "react"

import { Heart } from "lucide-react"
import { useFavoritesStore } from "@/store/favoritesStore";
import { useState } from "react"
import { Button } from "./ui/button"
// import { ButtonHTMLAttributes } from "react";
interface FavoriteHeartProps {
  recipeId: number
  recipeName: string
  recipeCategory: string
  className?: string
}

export function FavoriteHeart({ recipeId, recipeName, recipeCategory, className = "h-6 w-6" }: FavoriteHeartProps) {
  const { isFavoriteRecipe, toggleFavoriteRecipe } = useFavoritesStore()
  const [isAnimating, setIsAnimating] = useState(false)

  const isFavorite = isFavoriteRecipe(recipeId)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 300)

    toggleFavoriteRecipe({
      id: recipeId,
      name: recipeName,
      category: recipeCategory,
    })
  }

  return (
    <Button
    type="button" // ✅ Always set button type
    aria-pressed={isFavorite ? "true" : "false"}
      onClick={handleClick}
      className="inline-flex items-center justify-center rounded-full p-2 transition-all duration-200 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 dark:focus:ring-offset-background"
      aria-label={isFavorite ? "Remove from favorites" : " op Add to favorites"}
    >
      <Heart
        className={`${className} transition-all duration-200 ${
          isFavorite ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-foreground"
        } ${isAnimating ? "scale-125" : "scale-100"}`}
      />
    </Button>
  )
}
