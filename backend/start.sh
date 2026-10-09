#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PID_FILE="$DIR/server.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "YouTube Downloader Helper è già attivo (PID $PID)."
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

echo "Avvio YouTube Downloader Helper su http://127.0.0.1:8765..."
python3 "$DIR/server.py" </dev/null >> "$DIR/server.log" 2>&1 &
NEW_PID=$!
disown $NEW_PID
echo "$NEW_PID" > "$PID_FILE"
sleep 1

if ps -p "$NEW_PID" > /dev/null 2>&1; then
    echo "Server avviato con successo con PID $NEW_PID!"
else
    echo "Errore avvio server. Log:"
    cat "$DIR/server.log"
    exit 1
fi
