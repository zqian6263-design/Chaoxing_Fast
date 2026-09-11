#!/usr/bin/env bash
cd "$(dirname "$0")"
nohup node start.mjs --headless > watch_run.log 2>&1 &
sleep 5
echo "已启动，进度页: http://127.0.0.1:7788"
