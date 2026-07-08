import { type APIRequestContext } from "@playwright/test";

export interface SeededRestaurant {
  id: string;
  name: string;
  slug: string;
}

/**
 * Seeds one published (ACTIVE + PUBLIC) restaurant with a category and an
 * available menu item, via the same public catalog write API a restaurant
 * owner would use. server_2 has no `RESTAURANT_OWNER` role — any authenticated
 * user owns whatever restaurant they create (ownership is enforced via
 * `restaurant.ownerId`, not a role check) — so this registers a disposable
 * CUSTOMER per call. Mirrors the fresh-user-per-run pattern in
 * `auth-register.spec.ts` — no cleanup; each run uses a unique name/email.
 */
export async function seedRestaurant(
  request: APIRequestContext,
  overrides: { name?: string; cuisineTypes?: string[] } = {},
): Promise<SeededRestaurant> {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e.discovery.${unique}@flavorstack.local`;
  const name = overrides.name ?? `Discovery Diner ${unique}`;
  const cuisineTypes = overrides.cuisineTypes ?? ["ITALIAN"];
  const phone = `+91${unique.slice(-9).padStart(9, "9")}0`;

  await request.post("/api/v1/auth/register", {
    data: {
      role: "CUSTOMER",
      customer: {
        name: "Discovery Owner",
        email,
        phone,
        password: "Test@1234",
        address: {
          street: "123 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pinCode: "560001",
          lat: 12.9716,
          lng: 77.5946,
        },
      },
    },
  });

  const loginRes = await request.post("/api/v1/auth/login", {
    data: { email, password: "Test@1234" },
  });
  const { accessToken } = (await loginRes.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };

  const restaurantRes = await request.post("/api/v1/catalog/restaurants", {
    headers,
    data: {
      name,
      cuisineTypes,
      phone,
      address: {
        street: "123 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560001",
        coordinates: { lat: 12.9716, lng: 77.5946 },
      },
      location: { lat: 12.9716, lng: 77.5946 },
    },
  });
  const restaurant = (await restaurantRes.json()) as { id: string; slug: string };

  const categoryRes = await request.post(
    `/api/v1/catalog/restaurants/${restaurant.id}/categories`,
    { headers, data: { label: "Mains", sortOrder: 0 } },
  );
  const categoryBody = (await categoryRes.json()) as {
    categories: { id: string }[];
  };
  const categoryId = categoryBody.categories[categoryBody.categories.length - 1].id;

  await request.post(`/api/v1/catalog/restaurants/${restaurant.id}/items`, {
    headers,
    data: {
      categoryId,
      name: "Margherita Pizza",
      description: "Classic",
      basePrice: { amount: 29999, currency: "INR" },
      dietary: ["VEG"],
    },
  });

  await request.post(`/api/v1/catalog/restaurants/${restaurant.id}/publish`, { headers });
  await request.patch(`/api/v1/catalog/restaurants/${restaurant.id}/visibility`, {
    headers,
    data: { visibility: "PUBLIC" },
  });

  return { id: restaurant.id, name, slug: restaurant.slug };
}
