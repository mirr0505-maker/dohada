// 🚀 Supabase row 타입 (snake_case 그대로) + UI 파생 타입
// 정식 generated types 가 들어오면 (supabase gen types typescript) 이 파일을 덮어쓰면 됨.

export type DbUser = {
  id: string;
  email: string | null;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
};

export type ChallengeKind = 'closed' | 'solo';

export type DbChallenge = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  kind: ChallengeKind;
  start_date: string;   // YYYY-MM-DD
  end_date: string;
  created_at: string;
};

export type DbProof = {
  id: string;
  challenge_id: string;
  user_id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
};

export type DbCheer = {
  id: string;
  proof_id: string;
  user_id: string;
  created_at: string;
};

// ─── UI 용 파생 ────────────────────────────────────────
export type ChallengeWithCount = DbChallenge & {
  member_count: number;
};

export type MemberWithToday = DbUser & {
  today_checked: boolean;
  paused_until: string | null;
};

export type ProofWithRelations = DbProof & {
  author: DbUser;
  cheer_count: number;
  cheered_by_me: boolean;
};
