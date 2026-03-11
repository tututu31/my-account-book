@echo off
chcp 65001 >nul
echo ========================================
echo   GitHub 저장소 최초 연동 (Setup)
echo ========================================

:: 1. Git 설치 확인
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Git이 설치되어 있지 않습니다.
    echo 먼저 https://git-scm.com/ 에서 Git을 설치해주세요.
    pause
    exit
)

:: 2. 저장소 초기화
if not exist ".git" (
    echo [1/3] Git 저장소를 초기화합니다...
    git init
) else (
    echo [1/3] 이미 초기화된 저장소입니다.
)

:: 3. 리모트 연결
echo [2/3] GitHub 저장소를 연결합니다...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/tututu31/my-account-book.git

:: 4. 로컬 파일 먼저 기록 (충돌 방지)
echo [3/3] 로컬 파일을 기록하고 서버와 합칩니다...
git add .
git commit -m "Setup: Initialize with local version" >nul 2>&1
git branch -M main

:: 서버 데이터와 병합 (로컬 파일 우선)
git pull origin main --allow-unrelated-histories -X ours

:: GitHub로 푸시하여 동기화 완료
git push -u origin main

echo ========================================
echo   설정이 완료되었습니다! 
echo   이제 'Sync.bat'을 실행하여 평소처럼 업데이트하세요.
echo ========================================
pause
