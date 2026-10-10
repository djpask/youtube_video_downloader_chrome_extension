#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PID_FILE="$DIR/server.pid"

STOPPED=0

# 1. Prova a fermare tramite PID salvato
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
        echo "Arresto processo con PID $PID..."
        kill "$PID" 2>/dev/null
        sleep 1
        if ps -p "$PID" > /dev/null 2>&1; then
            kill -9 "$PID" 2>/dev/null
        fi
        STOPPED=1
    fi
    rm -f "$PID_FILE"
fi

# 2. Verifica e termina eventuali processi server.py residui
PIDS=$(pgrep -f "python3.*${DIR}/server.py" 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "Terminazione processi residui: $PIDS"
    kill $PIDS 2>/dev/null
    sleep 1
    STOPPED=1
fi

if [ $STOPPED -eq 1 ]; then
    echo "✅ YouTube Downloader Helper arrestato con successo."
else
    echo "ℹ️ Il server helper non era in esecuzione."
fi
