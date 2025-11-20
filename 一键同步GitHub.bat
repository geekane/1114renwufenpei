@echo off
echo 开始代码同步...

:: Add all changes to git
git add .

:: Commit with "进行修正"
git commit -m "进行修正"

:: Push changes to the main branch
git push origin main

echo 代码同步完成！
pause