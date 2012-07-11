#!/bin/bash
set -x 
SERVER="localhost:4465"
#SERVER="notifier.bradhowes.c9"

function usage
{
    cat << +EOF+
usage: addtemp EVTID NOTID TVERS TLANG SVC ROUTE TXT

EVTID: Skype event ID to register under [eventId]
NOTID: unique notification ID for this template [notificationId]
TVERS: template version to register for [templateVersion]
TLANG: template langugage to register for [templateLanguage]
SVC: service to deliver the notification ("wns", "apns", "mpns") [service]
ROUTE: route name to register under [route]
TXT: template text [template]
+EOF+
    exit 1
}

if (( $# != 7 )); then
    usage
fi

read -r -d '' JSON << EOF
{"eventId":"${1}","notificationId":"${2}","templateVersion":"${3}","templateLanguage":"${4}",
 "service":"${5}","route":"${6}","template":"${7}"}
EOF

curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -X POST \
     -H 'Content-Type: application/json' -d "${JSON}" http://${SERVER}/templates
echo
