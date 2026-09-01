# 싱크노트 웹

폰·태블릿·PC 어디서나 같은 노트를. 싱크노트 웹 클라이언트입니다.

## 개발
npm install
npm run dev

## 구조
- auth/ 로그인·세션
- billing/ 요금제·환불 계산
- sync/ 저장·동기화
- upload/ 첨부 파일 제한
- search/ 노트 검색 색인
- editor/ 에디터 확장(표, 태그)
- preview/ 모바일 공용 이미지 미리보기 모듈 (Android)
- server/ 저장 서버 클라이언트

## 환경 변수
.env.example 참고

## 배포
main에 push하면 GitHub Pages로 배포됩니다.
