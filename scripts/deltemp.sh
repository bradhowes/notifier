#!/bin/bash

set -x 

SERVER="localhost:4465"
#SERVER="notifier.bradhowes.c9.io"

function usage
{
    cat << +EOF+
usage: deltemp EVTID NOTID TVERS TLANG SVC ROUTE

EVTID: Skype event ID to query for [eventId]
NOTID: Notification ID to query for [eventId]
TVERS: template version to query for [templateVersion]
TLANG: template langugage to query for [templateLanguage]
SVC: service to query for ("wns", "apns", "mpns") [service]
ROUTE: route name to query for [route]
+EOF+
    exit 1
}

if (( $# != 6 )); then
    usage
fi

read -r -d '' JSON << EOF
{"eventId":"${1}","notificationId":"${2}","templateVersion":"${3}","templateLanguage":"${4}",
 "service":"${5}","route":"${6}"}
EOF

curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -X DELETE \
     -H 'Content-Type: application/json' -d "${JSON}" "http://${SERVER}/templates"

echo
