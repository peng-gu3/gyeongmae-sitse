# 농수산 경매시세 (gyeongmae-sitse)

전국 공영도매시장 실시간 경매 낙찰가를 폰에서 보는 앱.

## 배포 순서 (한 번만)

### 1. GitHub에 올리기
1. github.com → 우측 상단 [+] → New repository
2. Repository name: `gyeongmae-sitse` → Create
3. 만들어진 페이지에서 "uploading an existing file" 클릭
4. 이 폴더 안의 **모든 파일**을 드래그해서 올림 (node_modules 폴더는 빼고)
5. 아래 [Commit changes] 클릭

### 2. Vercel에서 배포
1. vercel.com → [Add New] → [Project]
2. 방금 만든 gyeongmae-sitse 저장소 옆 [Import] 클릭
3. **Environment Variables** 열고 아래 입력 후 [Add]:
   - Name(이름):  DATA_GO_KR_KEY
   - Value(값):   (data.go.kr 인증키)
4. [Deploy] 클릭 → 1~2분 기다리면 완료
5. 나오는 주소(gyeongmae-sitse.vercel.app)를 부모님께 카톡으로 전송

## 인증키 재발급 (권장)
연동 후 data.go.kr 마이페이지에서 인증키를 새로 발급받고,
Vercel의 DATA_GO_KR_KEY 값도 새 키로 교체하세요.
