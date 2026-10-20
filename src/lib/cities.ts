/**
 * Curated city suggestions for the onboarding + settings forms.
 *
 * These are shown as autocomplete suggestions, not an enforced dropdown —
 * the user can always type their own city. We keep the list small
 * (~top 40 Indian + top 20 global) so the dropdown stays scannable;
 * typing anything shows all matches.
 */

export interface CitySuggestion {
  name: string;
  country: string; // ISO 3166-1 alpha-2
}

export const CITY_SUGGESTIONS: CitySuggestion[] = [
  // India — tier 1 metros
  { name: "Mumbai", country: "IN" },
  { name: "Delhi", country: "IN" },
  { name: "Bangalore", country: "IN" },
  { name: "Hyderabad", country: "IN" },
  { name: "Chennai", country: "IN" },
  { name: "Kolkata", country: "IN" },
  { name: "Pune", country: "IN" },
  { name: "Ahmedabad", country: "IN" },
  // India — tier 1 NCR + satellites
  { name: "Gurgaon", country: "IN" },
  { name: "Noida", country: "IN" },
  { name: "Faridabad", country: "IN" },
  { name: "Ghaziabad", country: "IN" },
  { name: "Greater Noida", country: "IN" },
  // India — tier 2
  { name: "Jaipur", country: "IN" },
  { name: "Lucknow", country: "IN" },
  { name: "Chandigarh", country: "IN" },
  { name: "Indore", country: "IN" },
  { name: "Bhopal", country: "IN" },
  { name: "Nagpur", country: "IN" },
  { name: "Surat", country: "IN" },
  { name: "Vadodara", country: "IN" },
  { name: "Coimbatore", country: "IN" },
  { name: "Kochi", country: "IN" },
  { name: "Thiruvananthapuram", country: "IN" },
  { name: "Visakhapatnam", country: "IN" },
  { name: "Mysore", country: "IN" },
  { name: "Mangalore", country: "IN" },
  { name: "Nashik", country: "IN" },
  { name: "Dehradun", country: "IN" },
  { name: "Guwahati", country: "IN" },
  { name: "Bhubaneswar", country: "IN" },
  { name: "Patna", country: "IN" },
  { name: "Ranchi", country: "IN" },
  { name: "Raipur", country: "IN" },
  { name: "Amritsar", country: "IN" },
  { name: "Ludhiana", country: "IN" },
  { name: "Goa", country: "IN" },

  // UAE
  { name: "Dubai", country: "AE" },
  { name: "Abu Dhabi", country: "AE" },
  { name: "Sharjah", country: "AE" },

  // UK
  { name: "London", country: "GB" },
  { name: "Manchester", country: "GB" },
  { name: "Birmingham", country: "GB" },

  // USA
  { name: "New York", country: "US" },
  { name: "San Francisco", country: "US" },
  { name: "Los Angeles", country: "US" },
  { name: "Chicago", country: "US" },
  { name: "Houston", country: "US" },

  // Singapore / SEA / APAC
  { name: "Singapore", country: "SG" },
  { name: "Kuala Lumpur", country: "MY" },
  { name: "Bangkok", country: "TH" },
  { name: "Jakarta", country: "ID" },
  { name: "Sydney", country: "AU" },
  { name: "Melbourne", country: "AU" },

  // Middle East
  { name: "Riyadh", country: "SA" },
  { name: "Jeddah", country: "SA" },
  { name: "Doha", country: "QA" },
  { name: "Kuwait City", country: "KW" },
  { name: "Manama", country: "BH" },
  { name: "Muscat", country: "OM" },

  // Africa
  { name: "Lagos", country: "NG" },
  { name: "Nairobi", country: "KE" },
  { name: "Johannesburg", country: "ZA" },
  { name: "Cape Town", country: "ZA" },
  { name: "Accra", country: "GH" },

  // Canada
  { name: "Toronto", country: "CA" },
  { name: "Vancouver", country: "CA" },
];

/**
 * Fuzzy match helper for autocomplete.
 * Returns suggestions where the city name contains the query (case-insensitive),
 * optionally filtered to a specific country.
 */
export function matchCities(query: string, country?: string, limit = 8): CitySuggestion[] {
  const q = query.trim().toLowerCase();
  const base = country ? CITY_SUGGESTIONS.filter((c) => c.country === country) : CITY_SUGGESTIONS;
  if (!q) return base.slice(0, limit);
  const matches = base.filter((c) => c.name.toLowerCase().includes(q));
  // Prefer names that START with the query, then alphabetical.
  matches.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts || a.name.localeCompare(b.name);
  });
  return matches.slice(0, limit);
}
