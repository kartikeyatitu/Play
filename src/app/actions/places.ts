"use server";

/**
 * Server-side Google Places (New) autocomplete.
 *
 * Keeps the API key server-only — the browser never sees it.
 * Called from CityAutocomplete via a debounced React effect.
 *
 * Env: GOOGLE_PLACES_API_KEY (sensitive, set in Vercel)
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 */

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

export interface PlaceSuggestion {
  placeId: string;
  /** e.g. "Mumbai" */
  mainText: string;
  /** e.g. "Maharashtra, India" */
  secondaryText: string;
  /** Convenience: best guess at ISO country code, parsed from secondaryText. */
  country?: string;
}

/** Rough country-name → ISO 3166-1 alpha-2. Only covers common cases Triq cares about. */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  india: "IN",
  "united arab emirates": "AE",
  uae: "AE",
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  singapore: "SG",
  malaysia: "MY",
  thailand: "TH",
  indonesia: "ID",
  australia: "AU",
  "saudi arabia": "SA",
  qatar: "QA",
  kuwait: "KW",
  bahrain: "BH",
  oman: "OM",
  nigeria: "NG",
  kenya: "KE",
  "south africa": "ZA",
  ghana: "GH",
  canada: "CA",
};

function guessCountry(secondaryText: string): string | undefined {
  // Secondary text usually ends with ", <Country>", e.g. "Maharashtra, India"
  const last = secondaryText.split(",").pop()?.trim().toLowerCase();
  if (!last) return undefined;
  return COUNTRY_NAME_TO_CODE[last];
}

export async function searchCities(input: string): Promise<PlaceSuggestion[]> {
  const q = input.trim();
  if (q.length < 2) return [];

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.warn("[places] GOOGLE_PLACES_API_KEY not set — returning no suggestions");
    return [];
  }

  try {
    const res = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // Minimum fields we actually need — reduces billable session SKU cost.
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input: q,
        // Cities + towns + municipalities, which cover almost every academy location.
        includedPrimaryTypes: ["locality", "administrative_area_level_3", "sublocality"],
        languageCode: "en",
      }),
      // Avoid Next.js caching autocomplete responses between users.
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[places] autocomplete failed", res.status, text.slice(0, 200));
      return [];
    }

    const data = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
    };

    const suggestions = (data.suggestions || [])
      .map((s): PlaceSuggestion | null => {
        const p = s.placePrediction;
        const mainText = p?.structuredFormat?.mainText?.text || "";
        const secondaryText = p?.structuredFormat?.secondaryText?.text || "";
        const placeId = p?.placeId || "";
        if (!mainText || !placeId) return null;
        return {
          placeId,
          mainText,
          secondaryText,
          country: guessCountry(secondaryText),
        };
      })
      .filter((s): s is PlaceSuggestion => s !== null);

    return suggestions;
  } catch (err) {
    console.error("[places] fetch error", err);
    return [];
  }
}
