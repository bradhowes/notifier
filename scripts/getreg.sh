#!/bin/bash

SERVER="${NOTIFIER:-localhost:4465}"

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

set -x
curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -X GET \
     -H 'Content-Type: application/json' \
     -L http://${SERVER}/registrations/${1}
echo
