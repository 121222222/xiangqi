@echo off
chcp 65001 >nul
echo ========================================
echo    提交代码到 GitHub / 工蜂
echo ========================================
echo.

:: 显示当前状态
echo [1/4] 当前文件状态:
git status --short
echo.

:: 添加所有修改
echo [2/4] 添加所有修改到暂存区...
git add .
echo 已添加所有文件
echo.

:: 获取提交信息
set /p commit_msg="[3/4] 请输入提交说明: "
if "%commit_msg%"=="" set commit_msg=update

:: 提交到本地仓库
echo.
echo 正在提交...
git commit -m "%commit_msg%"
echo.

:: 推送到远程仓库
echo [4/4] 推送到远程仓库 (main 分支)...
git push -u origin main

echo.
echo ========================================
echo    提交完成！
echo ========================================
echo.
pause
