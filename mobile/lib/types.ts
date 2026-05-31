// 🚀 Supabase row 타입 (snake_case 그대로) + UI 파생 타입
// 정식 generated types 가 들어오면 (supabase gen types typescript) 이 파일을 덮어쓰면 됨.

export type DbUser = {
  id: string;
  email: string | null;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
};

export type ChallengeKind = 'closed' | 'solo' | 'open';

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

// 인증 응원 4가지 (0007 cheers.cheer_type 컬럼)
export type CheerType = 'fire' | 'clap' | 'muscle' | 'heart';

export type DbCheer = {
  id: string;
  proof_id: string;
  user_id: string;
  cheer_type: CheerType;
  created_at: string;
};

// 챌린지 평가 4가지 (둘러보기 카드 — challenge_votes.vote_type)
export type ChallengeVoteType = 'creative' | 'hard' | 'touching' | 'fresh';

export type DbChallengeVote = {
  id: string;
  challenge_id: string;
  user_id: string;
  vote_type: ChallengeVoteType;
  created_at: string;
};

export type DbComment = {
  id: string;
  proof_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type CommentWithAuthor = DbComment & {
  author: DbUser;
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
  // 4가지 응원 카운트 (0007). 기존 cheer_count 호환을 위해 합도 같이 노출.
  cheer_count: number;                                  // 모든 type 합
  cheered_by_me: boolean;                               // 1개 이상 응원했나
  cheers_by_type: Record<CheerType, number>;            // type 별 카운트
  my_cheers: CheerType[];                               // 내가 누른 type 들
  comment_count: number;
};

// 챌린지 평가 4가지 — 둘러보기 카드용 카운트
export type ChallengeVoteCounts = Record<ChallengeVoteType, number>;
