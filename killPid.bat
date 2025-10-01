@echo off
setlocal enabledelayedexpansion

echo ========================================
echo 端口进程终止工具
echo ========================================
echo.

:: 定义要检查的端口数组
set "ports=3000 8080"

:: 遍历每个端口
for %%p in (%ports%) do (
    echo [端口 %%p] 正在查找占用进程...
    netstat -ano | findstr :%%p
    
    echo.
    echo [端口 %%p] 正在终止占用进程...
    
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p') do (
        if not "%%a"=="0" (
            echo   正在终止进程 PID: %%a
            taskkill /PID %%a /F >nul 2>&1
            if !errorlevel! equ 0 (
                echo   ✓ 成功终止进程 PID: %%a
            ) else (
                echo   ✗ 无法终止进程 PID: %%a
            )
        )
    )
    
    echo
    echo [端口 %%p] 检查端口状态...
    netstat -ano | findstr :%%p >nul 2>&1
    if !errorlevel! equ 0 (
        echo   ⚠  端口 %%p 仍被占用
    ) else (
        echo   ✓  端口 %%p 已释放
    )
    echo.
    echo ----------------------------------------
    echo.
)

echo ========================================
echo 最终端口状态检查
echo ========================================
echo.

:: 最终检查所有端口状态
for %%p in (%ports%) do (
    netstat -ano | findstr :%%p >nul 2>&1
    if !errorlevel! equ 0 (
        echo 端口 %%p: 仍被占用
    ) else (
        echo 端口 %%p: 已释放 ✓
    )
)

echo.
echo 操作完成！
pause