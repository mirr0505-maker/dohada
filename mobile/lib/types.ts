// 🚀 Supabase row 타입 (snake_case 그대로) + UI 파생 타입
// 정식 generated types 가 들어오면 (supabase gen types typescript) 이 파일을 덮어쓰면 됨.

export type DbUser = {
  id: string;
  email: string | null;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
};

// 챌린지 방 4종
//   solo    — 비공개, 본인만
//   cheered — 본인 1명 도전 + 초대된 지인 N명 응원 (둘러보기 X)
//   closed  — 멤버 다수 함께 도전 (둘러보기 X)
//   open    — 누구나 합류, 둘러보기 공개
export type ChallengeKind = 'closed' | 'solo' | 'open' | 'cheered';

// 인증 빈도 — 0007 마이그레이션 challenges.frequency 컬럼.
//   daily   : 매일 1회
//   weekly3 : 주 3회
//   weekly1 : 주 1회
export type ChallengeFrequency = 'daily' | 'weekly3' | 'weekly1';

// 목표 유형 — 0041 challenges.goal_type 컬럼.
//   cadence : 주기형 (기간 × frequency 로 목표 인증 수, 일일/주기 의무)
//   count   : 목표 횟수형 (기간 내 target_count 개 달성하면 완주 — 100대명산·올레 완주 등)
export type ChallengeGoalType = 'cadence' | 'count';

export type DbChallenge = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  kind: ChallengeKind;
  start_date: string;   // YYYY-MM-DD
  end_date: string;
  created_at: string;
  frequency?: ChallengeFrequency;     // 0007: 인증 빈도 (기본 daily)
  invitation_message?: string | null; // 🚀 초대 메시지: 개설자가 동료들을 초대할 때 보낼 커스텀 소환장 메시지
  intro_image_url?: string | null;    // 🚀 0037: 안내문 이미지 (보관함, 합류 전 미리보기·방 현황에 노출)
  bet_tier?: string | null;           // 🚀 0040: 다인 내기 티어 (다함께·누구나, null=내기 없음)
  bet_donation_mode?: string | null;  // 🚀 0040: 다인 내기 기부 모드 (commitment/pledge/always)
  goal_type?: ChallengeGoalType;      // 🚀 0041: 목표 유형 (기본 cadence)
  target_count?: number | null;       // 🚀 0041: count 유형의 목표 개수 (cadence 는 null)
  gave_up_at: string | null; // 🚀 개설자가 챌린지 포기한 시각 (비활성화 판단용)
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
  is_today_checked?: boolean;
  my_streak?: number;
  has_new_chat?: boolean;
  has_new_log?: boolean;
  my_proof_count?: number;   // 🚀 0041: 내 총 인증 수 (count 유형 진행도 N/목표)
};

export type MemberWithToday = DbUser & {
  today_checked: boolean;
  paused_until: string | null;
  joined_at: string;     // 정렬용 — '시간의 흐름' (비교 압박 회피)
  gave_up_at: string | null;   // 도전 포기 (soft delete) — 본인 화면 hide, 다른 멤버는 '포기' 라벨
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

// 둘러보기 카드 (v4 disc-card) 용 풀 데이터
export type OpenChallengeCard = ChallengeWithCount & {
  creator: { nickname: string };
  category: { emoji: string; name: string; is_impact: boolean } | null;
  subcategory: { name: string } | null;
  votes_by_type: ChallengeVoteCounts;
  my_votes: ChallengeVoteType[];
};

// ─── v2.5: 해냈어요 (완주 이야기) ─────────────────────
// "자랑 X · 증언 ✓" 톤. 시스템 통계는 트리거가 자동 채움 (조작 불가).
// 사용자 옵션: story / hardest / photo_urls / visibility.

export type StoryVisibility = 'public' | 'allies';

export type DbCompletionStory = {
  id: string;
  challenge_id: string;
  user_id: string;
  // 시스템 통계 (DB 트리거 자동 채움 — 조작 불가)
  total_days: number;
  proof_count: number;
  longest_streak: number;
  completion_rate: number;       // 0~100
  // 사용자 옵션 — 6개 항목 모두 선택. 빈 항목은 상세에 노출 X.
  story: string | null;                  // 한 줄 소감
  hardest: string | null;                // 가장 어려웠던 점
  helped_when_giving_up: string | null;  // 포기하고 싶을 때 뭐가 도왔나
  advice_to_starters: string | null;     // 시작하는 사람에게 한마디
  own_tip: string | null;                // 나만의 방법·꿀팁
  what_changed: string | null;           // 이 도전으로 무엇이 달라졌나
  photo_urls: string[];
  visibility: StoryVisibility;
  created_at: string;
  updated_at: string;
};

// 해냈어요 공개 탭 / 상세 페이지 카드용 풀 데이터
export type CompletionStoryCard = DbCompletionStory & {
  author: DbUser;
  challenge: {
    title: string;
    category: { emoji: string; name: string } | null;
  };
  // 🚀 용기 받았어요 반응 (0029) — 단일 종류, 사용자당 1회
  courage_count: number;
  couraged_by_me: boolean;
};
