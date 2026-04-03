@echo off
chcp 65001 >nul
echo ========================================
echo    初始化 Git 仓库并关联远程仓库
echo ========================================
echo.

:: 初始化本地仓库
echo [1/4] 初始化本地 Git 仓库...
git init

:: 设置主分支为 main
echo.
echo [2/4] 设置主分支为 main...
git branch -M main

:: 添加远程仓库
echo.
echo [3/4] 添加远程仓库...
git remote add origin git@github.com:121222222/xiangqi.git

:: 验证远程仓库
echo.
echo [4/4] 验证远程仓库配置...
git remote -v

echo.
echo ========================================
echo    初始化完成！
echo ========================================
echo.
echo 远程仓库: git@github.com:121222222/xiangqi.git
echo 主分支: main
echo.
echo 接下来可以运行 push.bat 提交代码
echo.
pause
