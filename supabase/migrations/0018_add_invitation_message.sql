-- 🚀 초대 메시지 기능 추가
-- challenges 테이블에 개설자가 동료들을 초대할 때 보내는 커스텀 초대 메시지 컬럼을 추가합니다.
ALTER TABLE challenges ADD COLUMN invitation_message TEXT;

COMMENT ON COLUMN challenges.invitation_message IS '개설자가 작성한 초대 메시지 본문 (카카오톡 및 웹 초대장에 노출됨)';
