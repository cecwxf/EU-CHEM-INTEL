#!/bin/bash
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL}"
exec node /home/wttagent/.wtt-connect/agent/agent-5b736effe5f0/workspace/eu-chem-intel/server/quick.js
