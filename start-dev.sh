#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/pratikpatel/Documents/GitHub/road-travel-web
exec ng serve --port 3000
