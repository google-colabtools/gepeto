#!/bin/sh
nohup gunicorn keep_service:app --bind 0.0.0.0:7860 &
if [ "$RUN_ON_START" = "true" ]; then
  bash runner_daily.sh >/proc/1/fd/1 2>/proc/1/fd/2
fi