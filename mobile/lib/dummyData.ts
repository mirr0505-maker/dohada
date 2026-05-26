// 🚀 더미 데이터 — Week 1 UI 흐름 검증용
// Week 2 부터 Supabase 로 교체.

export type Challenge = {
  id: string;
  title: string;
  description: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  memberCount: number;
};

export type Proof = {
  id: string;
  challengeId: string;
  authorId: string;
  authorNickname: string;
  authorAvatar: string;   // emoji
  photoUrl: string;       // 임시: emoji 한 글자
  caption: string;
  createdAt: string;      // ISO
  cheerCount: number;
  cheeredByMe: boolean;
};

export type Member = {
  id: string;
  nickname: string;
  avatar: string;
  todayChecked: boolean;
};

export const challenges: Challenge[] = [
  {
    id: 'c1',
    title: '매일 아침 6시 기상',
    description: '미라클 모닝. 인증샷은 시계가 보이게.',
    startDate: '2026-05-26',
    endDate: '2026-06-25',
    memberCount: 5,
  },
  {
    id: 'c2',
    title: '하루 한 끼는 직접 요리',
    description: '편의점 김밥은 NO.',
    startDate: '2026-05-20',
    endDate: '2026-06-20',
    memberCount: 3,
  },
  {
    id: 'c3',
    title: '주 3회 30분 산책',
    description: '걷고 사진 한 장.',
    startDate: '2026-05-15',
    endDate: '2026-07-15',
    memberCount: 8,
  },
];

export const members: Member[] = [
  { id: 'u1', nickname: '나', avatar: '🐰', todayChecked: false },
  { id: 'u2', nickname: '도리', avatar: '🐻', todayChecked: true },
  { id: 'u3', nickname: '민수', avatar: '🦊', todayChecked: true },
  { id: 'u4', nickname: '지영', avatar: '🐼', todayChecked: false },
  { id: 'u5', nickname: '하늘', avatar: '🐶', todayChecked: true },
];

export const proofs: Proof[] = [
  {
    id: 'p1',
    challengeId: 'c1',
    authorId: 'u2',
    authorNickname: '도리',
    authorAvatar: '🐻',
    photoUrl: '🌅',
    caption: '오늘도 5:58 기상. 한강 산책 완료!',
    createdAt: '2026-05-26T06:10:00Z',
    cheerCount: 3,
    cheeredByMe: false,
  },
  {
    id: 'p2',
    challengeId: 'c1',
    authorId: 'u3',
    authorNickname: '민수',
    authorAvatar: '🦊',
    photoUrl: '☕',
    caption: '커피 한 잔으로 시작.',
    createdAt: '2026-05-26T06:25:00Z',
    cheerCount: 1,
    cheeredByMe: true,
  },
  {
    id: 'p3',
    challengeId: 'c1',
    authorId: 'u5',
    authorNickname: '하늘',
    authorAvatar: '🐶',
    photoUrl: '🏃',
    caption: '아침 러닝 5km. 오늘 미친 듯이 상쾌함.',
    createdAt: '2026-05-26T06:45:00Z',
    cheerCount: 5,
    cheeredByMe: false,
  },
];

// 현재 로그인 가정 (Week 2 이후 Supabase auth 로 교체)
export const currentUser = {
  id: 'u1',
  nickname: '도전자',
  avatar: '🐰',
};
