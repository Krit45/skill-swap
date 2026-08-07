import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface MatchRecommendation {
  uid: string;
  reason: string;
}

export interface MatchResult {
  recommendations: MatchRecommendation[];
  isFallback: boolean;
  error?: string;
}

export async function getMatchRecommendations(currentUser: UserProfile, allUsers: UserProfile[]): Promise<MatchResult> {
  const cacheKey = `recs_${currentUser.uid}_${JSON.stringify(currentUser.skillsOffered || [])}_${JSON.stringify(currentUser.skillsWanted || [])}`;
  const cached = sessionStorage.getItem(cacheKey);
  
  if (cached) {
    try {
      const { timestamp, data } = JSON.parse(cached);
      // Cache for 5 minutes
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        console.log("[AI] Using cached recommendations.");
        return { recommendations: data, isFallback: false };
      }
    } catch (e) {
      sessionStorage.removeItem(cacheKey);
    }
  }

  console.log(`[AI] Starting matching for ${currentUser.displayName} against ${allUsers.length} users`);
  
  const otherUsers = allUsers.filter(u => u.uid !== currentUser.uid);
  if (otherUsers.length === 0) {
    console.log("[AI] No other users found to match against.");
    return { recommendations: [], isFallback: false };
  }

  const getFallbackRecs = (error?: string): MatchResult => {
    console.log("[AI] Running fallback keyword matching...");
    const skillsWanted = currentUser.skillsWanted || [];
    const skillsOffered = currentUser.skillsOffered || [];

    const recs = otherUsers
      .map(user => {
        let score = 0;
        const userOffered = user.skillsOffered || [];
        const userWanted = user.skillsWanted || [];

        // Intersection of what I want and what they offer
        const match1 = skillsWanted.filter(s => 
          userOffered.some(os => os.toLowerCase().includes(s.toLowerCase()))
        ).length;
        // Intersection of what they want and what I offer
        const match2 = userWanted.filter(s => 
          skillsOffered.some(os => os.toLowerCase().includes(s.toLowerCase()))
        ).length;
        
        score += match1 * 10;
        score += match2 * 5;
        
        // Location bonus
        if (currentUser.location && user.location && currentUser.location === user.location) score += 5;
        
        // Rating bonus
        score += (user.rating || 5) * 2;

        const sharedSkill = skillsWanted.find(s => 
          userOffered.some(os => os.toLowerCase().includes(s.toLowerCase()))
        );

        return {
          uid: user.uid,
          reason: sharedSkill 
            ? `Great match! They can help you with ${sharedSkill}.` 
            : `Highly rated member with skills you might find useful.`,
          score
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ uid, reason }) => ({ uid, reason }));

    // Cache fallback results too
    sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: recs }));
    return { recommendations: recs, isFallback: true, error };
  };

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "") {
    console.warn("[AI] GEMINI_API_KEY not found. Using fallback matching.");
    return getFallbackRecs("AI API Key missing");
  }

  // Pre-filter: Get top 20 candidates using simple keyword matching to keep prompt size manageable
  const candidates = otherUsers
    .map(user => {
      let score = 0;
      const currentUserSkillsWanted = currentUser.skillsWanted || [];
      const currentUserSkillsOffered = currentUser.skillsOffered || [];
      const userSkillsOffered = user.skillsOffered || [];
      const userSkillsWanted = user.skillsWanted || [];

      // Intersection of what I want and what they offer
      const match1 = currentUserSkillsWanted.filter(s => 
        userSkillsOffered.some(os => os.toLowerCase().includes(s.toLowerCase()))
      ).length;
      // Intersection of what they want and what I offer
      const match2 = userSkillsWanted.filter(s => 
        currentUserSkillsOffered.some(os => os.toLowerCase().includes(s.toLowerCase()))
      ).length;
      
      score += match1 * 10;
      score += match2 * 5;
      
      // Location bonus
      if (currentUser.location && user.location && currentUser.location === user.location) score += 5;
      
      // Rating bonus
      score += (user.rating || 5) * 2;

      return { user, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(c => c.user);

  const formatLastActive = (date: any) => {
    if (!date) return "Unknown";
    try {
      if (date.toDate) return date.toDate().toLocaleDateString();
      if (date instanceof Date) return date.toLocaleDateString();
      return new Date(date).toLocaleDateString();
    } catch (e) {
      return "Unknown";
    }
  };

  const prompt = `
    You are an AI matching assistant for a SkillSwap platform.
    Current User:
    - Name: ${currentUser.displayName}
    - Skills Offered: ${(currentUser.skillsOffered || []).join(", ")}
    - Skills Wanted: ${(currentUser.skillsWanted || []).join(", ")}
    - Bio: ${currentUser.bio || "N/A"}
    - Location: ${currentUser.location || "N/A"}
    - Preferred Communication: ${currentUser.communicationStyle || "N/A"}
    - Rating: ${currentUser.rating || "N/A"}
    - Last Active: ${formatLastActive(currentUser.updatedAt)}

    Potential Matches:
    ${candidates.map((u, i) => `
    ${i + 1}. ${u.displayName}
       - Skills Offered: ${(u.skillsOffered || []).join(", ")}
       - Skills Wanted: ${(u.skillsWanted || []).join(", ")}
       - Bio: ${u.bio || "N/A"}
       - Location: ${u.location || "N/A"}
       - Preferred Communication: ${u.communicationStyle || "N/A"}
       - Rating: ${u.rating || 5.0}
       - Last Active: ${formatLastActive(u.updatedAt)}
       - UID: ${u.uid}
    `).join("\n")}

    Recommend the top 10 matches for the current user based on:
    1. Skill Alignment: Prioritize matches where one user offers what the other wants, and vice versa.
    2. Location: Prefer users in the same or nearby locations if they prefer "In-person" or "Hybrid" communication.
    3. Communication Style: Ensure their preferred communication styles are compatible (e.g., both like "Remote").
    4. User Rating: Favor users with higher ratings as they are more reliable.
    5. Recent Activity: Favor users who have been active recently as they are more likely to respond.

    Return the UIDs of the recommended users in order of relevance.
  `;

  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      console.log(`[AI] Calling Gemini API (Attempt ${retries + 1})...`);
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    uid: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ["uid", "reason"]
                }
              }
            },
            required: ["recommendations"]
          }
        }
      });

      const result = JSON.parse(response.text || '{"recommendations": []}');
      
      // Cache the successful result
      sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result.recommendations }));
      
      return { recommendations: result.recommendations, isFallback: false };
    } catch (error: any) {
      // Check for quota exceeded (429) or other common Gemini errors
      const errorMsg = error?.message || "";
      const errorStatus = error?.status || "";
      const errorString = JSON.stringify(error);
      
      const isQuotaError = 
        errorMsg.includes("429") || 
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorStatus === 429 ||
        errorString.includes("429") ||
        errorString.includes("RESOURCE_EXHAUSTED");

      if (isQuotaError) {
        console.warn("[AI] Gemini API Quota exceeded (429). Falling back to keyword matching immediately.");
        return getFallbackRecs("AI Quota Exceeded");
      }

      // Check for safety filters or other non-retryable errors
      if (errorMsg.includes("SAFETY") || errorMsg.includes("finishReason")) {
        console.warn("[AI] Gemini API Safety filter triggered. Falling back to keyword matching.");
        return getFallbackRecs("AI Safety Filter");
      }

      retries++;
      if (retries > maxRetries) {
        console.error("AI Matching Error after retries (Falling back to keyword matching):", error);
        break;
      }
      console.warn(`AI Matching attempt ${retries} failed, retrying...`, errorMsg || error);
      await new Promise(r => setTimeout(r, 1000 * retries)); // Exponential backoff
    }
  }

  // Fallback matching logic
  return getFallbackRecs("AI Matching Failed");
}
