#!/bin/bash

# Định nghĩa đường dẫn tương đối trong Github Workspace
DIR="rules"
BLOCK_OUT="./$DIR/blocklists.txt"
ALLOW_OUT="./$DIR/allowlists.txt"
PUBLIC_DIR="./public/rules"
BLOCK_TMP="/tmp/blocklists.tmp"
ALLOW_TMP="/tmp/allowlists.tmp"

# Tạo thư mục rules nếu chưa có
mkdir -p "./$DIR"
mkdir -p "$PUBLIC_DIR"

# Cleanup khi script exit
trap "rm -f $BLOCK_TMP $ALLOW_TMP; exit" INT TERM EXIT

extract_domains() {
  awk '{
    if (/^[[:space:]]*$/ || /^[!#]/) next
    line = tolower($0)
    sub(/^@@\|\|?/, "", line)
    sub(/^\|\|?/, "", line)
    sub(/\^.*/, "", line)
    sub(/[#!].*/, "", line)
    sub(/\/.*/, "", line)
    sub(/:.*/, "", line)
    sub(/^[0-9.]+[[:space:]]+/, "", line)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
    if (line ~ /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/ && !seen[line]++) print line
  }'
}

echo "Downloading and processing blocklists..."
curl -fsSL --max-time 60 \
https://raw.githubusercontent.com/bibicadotnet/blocklist_minimal/main/blocklists.txt \
| extract_domains > "$BLOCK_TMP"

echo "Downloading and processing allowlists..."
curl -fsSL --max-time 60 \
https://raw.githubusercontent.com/bibicadotnet/AdGuard-Home-blocklists/refs/heads/main/whitelist.txt \
https://raw.githubusercontent.com/ShadowWhisperer/BlockLists/refs/heads/master/Whitelists/Whitelist \
| extract_domains > "$ALLOW_TMP"

# Di chuyển file tmp vào thư mục đích
mv "$BLOCK_TMP" "$BLOCK_OUT"
mv "$ALLOW_TMP" "$ALLOW_OUT"
cp "$BLOCK_OUT" "$PUBLIC_DIR/blocklists.txt"
cp "$ALLOW_OUT" "$PUBLIC_DIR/allowlists.txt"
cp "./$DIR/private_tlds.txt" "$PUBLIC_DIR/private_tlds.txt"
cp "./$DIR/quad9_upstream.txt" "$PUBLIC_DIR/quad9_upstream.txt"
cp "./$DIR/redirect_rules.txt" "$PUBLIC_DIR/redirect_rules.txt"

echo "Done. Files saved to $BLOCK_OUT, $ALLOW_OUT and $PUBLIC_DIR"
