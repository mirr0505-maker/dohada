# 두하다 앱 아이콘 & Splash

## 📦 파일 구성

| 파일 | 용도 | 사이즈 |
|---|---|---|
| `icon.png` | 메인 앱 아이콘 (iOS + 일반) | 1024×1024 |
| `adaptive-icon.png` | Android adaptive icon 전경 | 1024×1024 |
| `splash-icon.png` | Splash 화면 심볼 | 1024×1024 |
| `favicon.png` | Web favicon | 48×48 |
| `icon-master.svg` | 마스터 벡터 원본 (수정 시 사용) | - |
| `adaptive-foreground.svg` | Android adaptive 전경 원본 | - |
| `splash-icon.svg` | Splash 심볼 원본 | - |

## 🎨 컨셉

- **배경**: `#FF6B35` (Sunset Orange — 응원·도전의 색)
- **양쪽 괄호**: 응원하는 사람들
- **가운데 원**: 완주의 사이클
- **가운데 도트**: 도전자 (시작의 점)

> `( ◯ • )` — 도전자가 응원에 감싸안긴 모습

## 🛠 Expo 설정

`app.json` (또는 `app.config.ts`)에 다음 추가:

```json
{
  "expo": {
    "name": "두하다",
    "slug": "dohada",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#FF6B35"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FF6B35"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

## 📁 파일 배치 (Expo 프로젝트)

```
dohada/
├── assets/
│   ├── icon.png            ← 여기 복사
│   ├── adaptive-icon.png   ← 여기 복사
│   ├── splash-icon.png     ← 여기 복사
│   └── favicon.png         ← 여기 복사
├── app.json                ← 위 설정으로 수정
└── ...
```

## 🔄 적용 후 확인

```bash
# Expo 캐시 클리어 후 재시작
npx expo start -c
```

iOS 시뮬레이터 / Android 에뮬레이터에서 홈 화면 아이콘과 Splash 확인.

## ✏️ 수정이 필요한 경우

SVG 파일들이 원본입니다. 색상/굵기/크기를 바꾼 후 `generate.py` 실행:

```bash
pip install cairosvg
python3 generate.py
```
