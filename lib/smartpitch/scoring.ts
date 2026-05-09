export interface QuizAnswers {
  service_interest: string;
  current_provider: string;
  pain_point: string;
  monthly_bill: string;
  switch_timeline: string;
  address: string;
  city: string;
  state_abbr: string;
  zip: string;
  customer_name: string;
  phone: string;
  email?: string;
  sms_consent: boolean;
}

export interface ScoringResult {
  score: number;
  temperature: "hot" | "warm" | "cold";
  recommended_pitch: string;
}

export function scoreQuiz(a: QuizAnswers): ScoringResult {
  let score = 0;

  // Service interest
  if (a.service_interest === "bundle")   score += 20;
  else if (["fiber", "wireless", "business"].includes(a.service_interest)) score += 15;

  // Competitor provider (AT&T existing = low urgency, other = high)
  if (a.current_provider === "att")      score += 5;
  else if (a.current_provider && a.current_provider !== "unsure") score += 15;

  // Monthly bill
  if      (a.monthly_bill === "over_200")  score += 20;
  else if (a.monthly_bill === "125_200")   score += 15;
  else if (a.monthly_bill === "75_125")    score += 10;
  else if (a.monthly_bill === "under_75")  score +=  5;

  // Switch timeline
  if      (a.switch_timeline === "today")       score += 25;
  else if (a.switch_timeline === "this_week")   score += 15;
  else if (a.switch_timeline === "this_month")  score += 10;

  // Pain point
  if (["high_bill", "slow", "drops"].includes(a.pain_point)) score += 10;

  // Contact quality
  if (a.phone?.trim())   score += 10;
  if (a.address?.trim()) score += 10;

  score = Math.min(score, 100);

  const temperature: ScoringResult["temperature"] =
    score >= 80 ? "hot" : score >= 50 ? "warm" : "cold";

  const recommended_pitch = buildPitch(a, temperature);

  return { score, temperature, recommended_pitch };
}

function buildPitch(
  a: QuizAnswers,
  temperature: ScoringResult["temperature"],
): string {
  const urgency = temperature === "hot"
    ? "This is a high-priority lead — move quickly."
    : temperature === "warm"
    ? "This lead is engaged — follow up within 24 hours."
    : "Nurture this lead with information and a follow-up call.";

  if (a.service_interest === "bundle") {
    return `Bundle savings pitch — show the combined fiber + wireless package and the exact monthly savings vs their current bills. Emphasize one bill, one company, one support line. ${urgency}`;
  }
  if (a.service_interest === "business") {
    return `Business solutions pitch — lead with dedicated fiber, uptime SLAs, and business account benefits. Mention priority support and scalability. ${urgency}`;
  }
  if (a.pain_point === "high_bill" || ["over_200", "125_200"].includes(a.monthly_bill)) {
    return `Savings pitch — pull up the exact monthly comparison and show the dollar-for-dollar difference. Ask: "What if we could cut that bill by $50 a month?" ${urgency}`;
  }
  if (a.pain_point === "slow" || a.pain_point === "drops") {
    return `Speed & reliability pitch — lead with fiber's guaranteed symmetrical speeds and no throttling. Mention that AT&T fiber is the network, not a reseller. ${urgency}`;
  }
  if (a.switch_timeline === "today") {
    return `Close today pitch — they're ready now. Lead with the activation incentive and same-day or next-day setup options. Don't over-explain, ask for the close. ${urgency}`;
  }
  if (a.service_interest === "wireless") {
    return `Wireless savings pitch — compare their current plan line-by-line. Show AT&T unlimited options and bundle savings if they also have home internet. ${urgency}`;
  }
  return `General comparison — walk through available plans and pricing for their address. Ask what matters most to them: price, speed, or reliability. ${urgency}`;
}
