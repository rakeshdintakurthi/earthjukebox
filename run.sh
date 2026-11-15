#!/usr/bin/env bash
echo "Starting Thermophone local HTTP server at http://localhost:8000 ..."
python3 -m http.server 8000 || python -m http.server 8000
