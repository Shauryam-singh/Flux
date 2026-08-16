#!/bin/bash
# Start Brave with remote debugging for Flux CDP control
# This enables Flux to control your real browser with
# all your tabs, sessions, and logged-in state.

echo "Starting Brave with remote debugging on port 9222..."
echo ""
echo "This enables Flux to control your real browser with"
echo "all your tabs, sessions, and logged-in state."
echo ""

# Try common Brave locations
BRAVE_PATH=""

if command -v brave &> /dev/null; then
    BRAVE_PATH="brave"
elif [ -f /usr/bin/brave-browser ]; then
    BRAVE_PATH="/usr/bin/brave-browser"
elif [ -f /usr/bin/brave ]; then
    BRAVE_PATH="/usr/bin/brave"
elif [ -f /opt/brave.com/brave/brave-browser ]; then
    BRAVE_PATH="/opt/brave.com/brave/brave-browser"
elif [ -f "$HOME/.local/share/brave.com/brave/brave-browser" ]; then
    BRAVE_PATH="$HOME/.local/share/brave.com/brave/brave-browser"
fi

if [ -z "$BRAVE_PATH" ]; then
    echo "ERROR: Brave not found in common locations."
    echo "Please install Brave or edit this script with the correct path."
    exit 1
fi

echo "Found Brave: $BRAVE_PATH"
echo ""

"$BRAVE_PATH" --remote-debugging-port=9222 &

echo "Brave launched with CDP on port 9222."
echo "Flux can now control your browser."
