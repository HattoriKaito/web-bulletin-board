export interface Race {
  id: number;
  venue: string;
  race_number: number;
  race_date: string;
  race_type: string;
  created_at: string;
}

export interface RaceEntry {
  id: number;
  race_id: number;
  boat_number: number;
  racer_name: string;
  local_win_rate: number | null;
  national_win_rate: number | null;
  motor_win_rate: number | null;
  flag_status: string | null;
  entry_course: number | null;
  exhibition_time: number | null;
  weather_condition: string | null;
  wind_direction: string | null;
  wind_speed: number | null;
}

export type Stage = "entry_confirmed" | "pre_race" | "final";

export interface ExtractedPreRegistrationEntry {
  boat_number: number;
  racer_name: string | null;
  local_win_rate: number | null;
  national_win_rate: number | null;
  motor_win_rate: number | null;
  flag_status: string | null;
  uncertain_fields: string[];
}

export interface ExtractedPreRegistrationResult {
  boats: ExtractedPreRegistrationEntry[];
}

export interface ExtractedPreRaceEntry {
  boat_number: number;
  entry_course: number | null;
  exhibition_time: number | null;
  weather_condition: string | null;
  wind_direction: string | null;
  wind_speed: number | null;
  uncertain_fields: string[];
}

export interface ExtractedPreRaceResult {
  boats: ExtractedPreRaceEntry[];
}

export interface Odds {
  id: number;
  race_id: number;
  stage: Stage;
  combination: string;
  odds_value: number;
  recorded_at: string;
}

export interface Rule {
  id: number;
  rule_text: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RuleStats {
  rule_id: number;
  applied_count: number;
  hit_count: number;
}

export interface Prediction {
  id: number;
  race_id: number;
  stage: Stage;
  suggested_bets: string[];
  summary_reasoning: string;
  detailed_reasoning: string;
  created_at: string;
}

export interface PredictionChatMessage {
  id: number;
  prediction_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface PredictionChatReply {
  user_message: PredictionChatMessage;
  assistant_message: PredictionChatMessage;
}

export interface Bet {
  id: number;
  race_id: number;
  bet_combination: string;
  amount: number;
  is_ai_suggested: boolean;
  created_at: string;
}

export interface BetsConfirmResult {
  actual_bets: Bet[];
  ai_suggested_bets: Bet[];
  ai_suggested_available: boolean;
}

export interface BetHitInfo {
  bet_id: number;
  combination: string;
  amount: number;
  is_ai_suggested: boolean;
  is_hit: boolean;
  winnings: number;
  net: number;
}

export interface BetGroupSummary {
  total_bet_amount: number;
  total_winnings: number;
  net_profit: number;
}

export interface RaceResult {
  id: number;
  race_id: number;
  finishing_order: string;
  payout_amount: number;
  created_at: string;
  bet_results: BetHitInfo[];
  actual_summary: BetGroupSummary;
  ai_suggested_summary: BetGroupSummary;
}

export interface RaceSummaryItem {
  race_id: number;
  venue: string;
  race_number: number;
  race_date: string;
  actual_summary: BetGroupSummary;
  ai_suggested_summary: BetGroupSummary;
}

export interface OverallSummary {
  races: RaceSummaryItem[];
  actual_total: BetGroupSummary;
  ai_suggested_total: BetGroupSummary;
}

export interface RaceTypeStats {
  race_type: string;
  total_races: number;
  hit_count: number;
  hit_rate: number;
}
