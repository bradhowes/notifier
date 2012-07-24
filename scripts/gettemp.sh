#!/bin/bash
set -x 
SERVER="localhost:4465"
#SERVER="notifier.bradhowes.c9.io"

function usage
{
    cat << +EOF+
usage: gettemp EVTID TVERS TLANG SVC ROUTE

EVTID: Skype event ID to query for [eventId]
TVERS: template version to query for [templateVersion]
TLANG: template langugage to query for [templateLanguage]
SVC: service to query for ("wns", "apns", "mpns") [service]
ROUTE: route name to query for [route]
+EOF+
    exit 1
}

if (( $# != 5 )); then
    usage
fi

curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -X GET \
     -H 'Content-Type: application/json' "http://${SERVER}/templates?eventId=${1}&templateVersion=${2}&templateLanguage=${3}&service=${4}&route=${5}"

echo
