#!/bin/bash

SERVER="${NOTIFIER:-localhost:4465}"

function usage
{
    cat << +EOF+
usage: delreg USER [REGID]

USER: remover registration for this user ID
REGID: registration to remove
+EOF+
    exit 1
}

set -x

if (( $# < 1 || $# > 2 )); then
    usage
fi

DATA=""

if [[ -n "${2}" ]]; then
    DATA="-d '{"registrationId":"${2}"}'"
fi

curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
    -X DELETE ${DATA} \
    -H 'Content-Type: application/json' -L --post301 --post302 http://${SERVER}/registrations/${1}

echo
