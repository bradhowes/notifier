#!/bin/bash

function usage
{
    cat << +EOF+
usage: getreg USER

USER: fetch registrations for this user ID
+EOF+
    exit 1
}

if (( $# < 1 )); then
    usage
fi

userId="${1}"

curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
    -H 'Content-Type: application/json' \
    http://notifier.bradhowes.c9.io/registrations/${userId}

echo
