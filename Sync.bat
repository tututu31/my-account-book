@echo off
chcp 65001 >nul
setlocal
echo ========================================
echo   GitHub 자동 동기화 시작 (Auto-Sync)
echo ========================================

:: 1. Git 설치 확인
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Git이 설치되어 있지 않습니다.
    pause
    exit
)

:: 2. 변경사항 저장 (Add & Commit) - Pull 전에 먼저 수행하여 충돌 방지
echo [1/3] 변경 내용을 기록합니다...
git add .
set /p commit_msg="업데이트 내용을 간단히 적어주세요 (엔터 치면 'site update'): "
if "%commit_msg%"=="" set commit_msg=site update
git commit -m "%commit_msg%"

:: 3. 최신 내용 가져오기 (Pull)
echo [2/3] 서버에서 최신 변경사항을 가져와 합칩니다...
:: 충돌 시 로컬 파일을 우선시하도록 설정
git pull origin main --allow-unrelated-histories -X ours

:: 4. GitHub로 전송 (Push)
echo [3/3] GitHub로 업로드합니다...
git push origin main

if %errorlevel% neq 0 (
    echo [실패] 업로드 도중 오류가 발생했습니다.
    echo 인터넷 연결이나 GitHub 권한을 확인해주세요.
) else (
    echo ========================================
    echo   동기화 완료! 웹사이트에 반영되기까지 1~2분 소요됩니다.
    echo ========================================
)

pause
