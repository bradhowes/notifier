#!/bin/bash

SERVER="localhost:4465"
#SERVER="notifier.bradhowes.c9.io"

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

curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -X DELETE \
     -H 'Content-Type: application/json' -d "{\"registrationId\":\"${2}\"}" http://${SERVER}/registrations/${1}

echo
