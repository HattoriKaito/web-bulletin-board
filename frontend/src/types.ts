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
