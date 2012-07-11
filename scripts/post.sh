#!/bin/bash

SERVER="localhost:4465"
#SERVER="notifier.bradhowes.c9"

function usage
{
    cat << +EOF+
usage: post USER EVTID [NAME VALUE] [NAME VALUE]...

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

USERID="${1}"
JSON="{\"eventId\":\"${2}\",\"substitutionValues\":{"
shift 2

COMMA=""
while (( $# > 0 ))
do
    if (( $# < 2 )); then
        usage
    fi
    JSON="${JSON}${COMMA}\"name\":\"${1}\",\"value\":\"${2}\""
    COMMA=","
    shift 2
done

JSON="${JSON}}}"

curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -X POST \
     -H 'Content-Type: application/json' \
     -d "${JSON}" http://${SERVER}/post/${USERID}

echo
