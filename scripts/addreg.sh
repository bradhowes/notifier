#!/bin/bash

SERVER="${NOTIFIER:-localhost:4465}"

function usage
{
    cat << +EOF+
usage: addreg USER DEVICE TVERS TLANG SVC NAME TOKEN TTL [NAME TOKEN TTL]...

USER: user ID to register under
DEVICE: unique device ID to add/update [deviceId]
TVERS: template version to register for [templateVersion]
TLANG: template langugage to register for [templateLanguage]
SVC: notification service to use ("wns", "apns", "mpns") [service]
NAME: route name to register [name]
TOKEN: service-specific route notification token to register [token]
TTL: route lifetime in seconds [secondsToLive]
+EOF+
    exit 1
}

if (( $# < 8 )); then
    usage
fi

USERID="${1}"
JSON="{\"deviceId\":\"${2}\",\"templateVersion\":\"${3}\",\"templateLanguage\":\"${4}\",\"service\":\"${5}\","
JSON="${JSON}\"routes\":["
shift 5
COMMA=""
while (( $# > 0 ))
do
    if (( $# < 3 )); then
        usage
    fi
    JSON="${JSON}${COMMA}{\"name\":\"${1}\",\"token\":\"${2}\",\"secondsToLive\":${3}}"
    COMMA=","
    shift 3
done

JSON="${JSON}]}"

set -x
curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -H 'Content-Type: application/json' -d "${JSON}" -L --post301 --post302 http://${SERVER}/registrations/${USERID}
echo
