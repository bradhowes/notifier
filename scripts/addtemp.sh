#!/bin/bash

SERVER="${NOTIFIER:-localhost:4465}"

function usage
{
    cat << +EOF+
usage: addtemp EVTID NOTID TVERS TLANG SVC ROUTE FILE

EVTID: Skype event ID to register under [eventId]
NOTID: unique notification ID for this template [notificationId]
TVERS: template version to register for [templateVersion]
TLANG: template langugage to register for [templateLanguage]
SVC: service to deliver the notification ("wns", "apns", "mpns") [service]
ROUTE: route name to register under [route]
TXT: template text - if '-', read from STDIN [template]
+EOF+
    exit 1
}

set -x

if (( $# != 7 )); then
    usage
fi

if [ "${7}" = "-" ]; then
    read -r -d '' -u 0 TXT
else
    TXT="${7}"
fi

# Uff. This not safe if there are escaped embedded quotations marks in the template body.
TXT=${TXT//\"/\\\"}

read -r -d '' JSON << EOF
{"eventId":"${1}","notificationId":"${2}","templateVersion":"${3}","templateLanguage":"${4}",
 "service":"${5}","route":"${6}","template":{"content":"${TXT}"}}
EOF

set -x 
curl -w "\nTime: %{time_total}s Response: %{http_code} Content-Type: %{content_type}" \
     -X POST \
     -H 'Content-Type: application/json' -d "${JSON}" -L --post301 --post302 http://${SERVER}/templates
echo
