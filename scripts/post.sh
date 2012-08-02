#!/bin/bash

set -x

SERVER="localhost:4465"
SERVER="notifier.bradhowes.c9.io:8080"

function usage
{
    cat << +EOF+
usage: post [-t TOKEN] USER EVTID [NAME VALUE] [NAME VALUE]...

TOKEN: restrict deliver to registrations containing TOKEN
USER: user ID to notify
EVTID: event ID to notify about
NAME: template placeholder name to substitute
VALUE: value to substitute for the placeholder NAME
+EOF+
    exit 1
}

if (( $# < 2 )); then
    usage
fi

TOKENS=""
COMMA=""

while [[ "${1}" = "-t" ]]; do
    TOKENS="${TOKENS}${COMMA}\"${2}\""
    COMMA=","
    shift 2
done

USERID="${1}"
JSON="{\"eventId\":\"${2}\""
shift 2

if [[ -n "${TOKENS}" ]]; then
    JSON="${JSON},\"tokens\":[${TOKENS}]"
fi

JSON="${JSON},\"substitutions\":{"

COMMA=""
while (( $# > 0 ))
do
    if (( $# < 2 )); then
        usage
    fi
    JSON="${JSON}${COMMA}\"${1}\":\"${2}\""
    COMMA=","
    shift 2
done

JSON="${JSON}}}"

curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -X POST \
     -H 'Content-Type: application/json' \
     -d "${JSON}" --key ../certs/client.key --cert ../certs/client.cert --cacert ../certs/ca.cert \
     -L https://${SERVER}/post/${USERID}

echo
