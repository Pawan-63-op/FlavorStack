"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { ImageWithFallback } from "@/figma/ImageWithFallback";
import { isEnabled } from "@/lib/config/featureFlags";
import { useGeolocation } from "@/lib/geo/useGeolocation";
import { useNearbyRestaurants } from "@/lib/api/hooks/useCatalog";
import { ApiError } from "@/lib/api/errors/ApiError";

/**
 * Flag-gated ("nearby") geolocation-driven discovery. Renders nothing when the
 * flag is off, so the default Home experience is unchanged. On request it asks
 * for the browser location, then lists restaurants within `radiusMeters`
 * (server returns them nearest-first). Image-with-fallback + open-status card
 * mirrors `RestaurantList`'s pattern.
 */

const RADIUS_OPTIONS: { label: string; meters: number }[] = [
  { label: "2 km", meters: 2000 },
  { label: "5 km", meters: 5000 },
  { label: "10 km", meters: 10000 },
  { label: "25 km", meters: 25000 },
];

function NearbyCard({
  id,
  name,
  cuisine,
  isOpen,
  imageUrl,
  onOpen,
}: {
  id: string;
  name: string;
  cuisine: string;
  isOpen: boolean;
  imageUrl?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <Card
      className="overflow-hidden border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
      onClick={() => onOpen(id)}
    >
      <div className="relative h-40 overflow-hidden">
        <ImageWithFallback
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        {!isOpen && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Badge variant="destructive">Closed</Badge>
          </div>
        )}
        {cuisine && (
          <Badge className="absolute top-3 left-3 bg-primary/90 border-0">{cuisine}</Badge>
        )}
      </div>
      <CardContent className="pt-4 space-y-2">
        <h3 className="font-semibold text-lg">{name}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{isOpen ? "Open now" : "Closed"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function NearbyResults({
  lat,
  lng,
  radiusMeters,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
}) {
  const router = useRouter();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNearbyRestaurants({ lat, lng, radiusMeters, deliverableOnly: true });

  // `deliverableOnly` is applied by the server, not here: a restaurant can be 800m away
  // and still not deliver to this point (its zone is a polygon, not a circle), and
  // filtering the returned page in the client would shrink pages and break the cursor.
  const restaurants = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-6">
        <Loader2 className="h-5 w-5 animate-spin" />
        Finding restaurants near you...
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError ? error.message : "Failed to load nearby restaurants";
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center space-y-3">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (restaurants.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          No restaurants delivering to you within this radius. Try widening it.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {restaurants.map((r) => (
          <NearbyCard
            key={r.id}
            id={r.id}
            name={r.name}
            cuisine={r.cuisine}
            isOpen={r.isOpen}
            imageUrl={r.imageUrl}
            onOpen={(id) => router.push(`/restaurants/${id}`)}
          />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export function NearbyRestaurants() {
  const { coords, status, error, request } = useGeolocation();
  const [radiusMeters, setRadiusMeters] = useState(5000);

  // Dark by default — the entire surface is gated by the `nearby` flag, so the
  // standard Home experience is provably unchanged when it's off.
  if (!isEnabled("nearby")) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2>Near You</h2>
        {coords && (
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((option) => (
              <Button
                key={option.meters}
                size="sm"
                variant={radiusMeters === option.meters ? "default" : "outline"}
                onClick={() => setRadiusMeters(option.meters)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {!coords ? (
        <Card className="border-2">
          <CardContent className="py-8 text-center space-y-3">
            <Navigation className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              Find restaurants that deliver around your current location.
            </p>
            <Button onClick={request} disabled={status === "prompting"} className="gap-2">
              {status === "prompting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Locating...
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" />
                  Find restaurants near me
                </>
              )}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <NearbyResults lat={coords.lat} lng={coords.lng} radiusMeters={radiusMeters} />
      )}
    </motion.section>
  );
}

export default NearbyRestaurants;
