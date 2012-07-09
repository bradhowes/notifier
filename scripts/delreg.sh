#!/bin/bash

function usage
{
    cat << +EOF+
usage: delreg USER REGID

USER: remover registration for this user ID
REGID: registration to remove
+EOF+
    exit 1
}

if (( $# != 2 )); then
    usage
fi

curl -X DELETE -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
    -H 'Content-Type: application/json' \
    -d "{\"registrationId\":\"${2}\"}" http://notifier.bradhowes.c9.io/registrations/${1}

echo
