#!/bin/bash

SERVER="localhost:4465"
#SERVER="notifier.bradhowes.c9.io"

function usage
{
    cat << +EOF+
usage: getreg USER

USER: fetch registrations for this user ID
+EOF+
    exit 1
}

if (( $# != 1 )); then
    usage
fi

curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -X GET \
     -H 'Content-Type: application/json' http://${SERVER}/registrations/${1}
echo
